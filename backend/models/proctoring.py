import cv2
import numpy as np
from ultralytics import YOLO
import io
import base64
from PIL import Image

# Initialize YOLOv8 Small model (better accuracy than nano for books/phones)
try:
    model = YOLO("yolov8s.pt")
except Exception as e:
    print(f"Failed to load YOLO model: {e}")
    model = None

# COCO classes for restricted objects
CRITICAL_CLASSES = {
    63: "Laptop detected",
    67: "Mobile phone detected",
    73: "Reference book detected"
}

# COCO classes for food items (46-55)
FOOD_CLASSES = {i: "Eating is not allowed during the exam" for i in range(46, 56)}

def detect_restricted_objects(base64_img: str):
    """
    Process a base64 encoded image and return structured critical and minor issues.
    Fixed:
    - Phone/Book confusion
    - Overlapping detections
    - Low confidence noise
    """

    if model is None:
        return {"critical": [], "minor": []}

    try:
        # Decode base64 image
        if "," in base64_img:
            base64_img = base64_img.split(",")[1]

        img_array = np.frombuffer(base64.b64decode(base64_img), np.uint8)
        img_cv = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        # 🔥 Use higher resolution for better accuracy
        results = model(img_cv, verbose=False, imgsz=640)

        best_detection = {}
        person_count = 0

        # -------------------------------
        # STEP 1: Collect best detections
        # -------------------------------
        for r in results:
            boxes = r.boxes
            for box in boxes:
                conf = box.conf[0].item()
                cls_id = int(box.cls[0].item())

                # Ignore weak detections
                if conf < 0.5:
                    continue

                if cls_id == 0:
                    person_count += 1
                    continue

                # Keep ONLY highest confidence per class
                if cls_id not in best_detection or conf > best_detection[cls_id]:
                    best_detection[cls_id] = conf

        # -------------------------------
        # STEP 2: Apply priority logic
        # -------------------------------
        critical_issues = []

        # Priority order: Phone > Laptop > Book
        if 67 in best_detection:
            critical_issues.append("Mobile phone usage detected")

        elif 63 in best_detection:
            critical_issues.append("External laptop/screen detected")

        elif 73 in best_detection:
            critical_issues.append("Reference book/material detected")

        # -------------------------------
        # STEP 3: Minor issues
        # -------------------------------
        minor_issues = []

        for cls_id in best_detection:
            if cls_id in FOOD_CLASSES:
                minor_issues.append(FOOD_CLASSES[cls_id])

        # -------------------------------
        # STEP 4: Person validation
        # -------------------------------
        if person_count > 1:
            critical_issues.append("Unauthorized person in frame")
        elif person_count == 0:
            minor_issues.append("Student not visible")

        # -------------------------------
        # DEBUG (optional for demo)
        # -------------------------------
        # print("Best Detection:", best_detection)

        return {
            "critical": list(set(critical_issues)),
            "minor": list(set(minor_issues))
        }

    except Exception as e:
        print(f"Proctoring error: {e}")
        return {"critical": [], "minor": []}