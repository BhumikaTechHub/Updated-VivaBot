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
    """
    if model is None:
        return {"critical": [], "minor": []}

    try:
        if "," in base64_img:
            base64_img = base64_img.split(",")[1]
            
  
        img_array = np.frombuffer(base64.b64decode(base64_img), np.uint8)
        img_cv = cv2.imdecode(img_array, cv2.IMREAD_COLOR)


        # Run inference with standard 640 resolution
        results = model(img_cv, verbose=False, imgsz=320)
        
        critical_issues = []
        minor_issues = []
        person_count = 0
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                conf = box.conf[0].item()
                cls_id = int(box.cls[0].item())
                
                # Use a more sensitive threshold (0.4) for restricted items
                if conf < 0.4:
                    continue

                if cls_id == 0:  # Person
                    person_count += 1
                elif cls_id == 67: # cell phone
                    critical_issues.append("Mobile phone usage detected")
                elif cls_id == 63: # laptop
                    critical_issues.append("External laptop/screen detected")
                elif cls_id == 73: # book
                    critical_issues.append("Reference book/material detected")
                elif cls_id in FOOD_CLASSES:
                    minor_issues.append(FOOD_CLASSES[cls_id])
                        
        if person_count > 1:
            critical_issues.append("Unauthorized person in frame")
        elif person_count == 0:
            minor_issues.append("Student not visible")
            
        return {
            "critical": list(set(critical_issues)),
            "minor": list(set(minor_issues))
        }

    except Exception as e:
        print(f"Proctoring error: {e}")
        return {"critical": [], "minor": []}
