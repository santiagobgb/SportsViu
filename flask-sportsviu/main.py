from flask import Flask
import os
import cv2
import tensorflow as tf
import tensorflow_hub as hub
import numpy as np
from collections import deque
import subprocess
import gdown
import matplotlib.pyplot as plt
from utils import loop_through_people, draw_keypoints, draw_connections, save_highlight_video, collect_right_hip_positions, EDGES
import firebase_admin
from firebase_admin import credentials
from firebase_admin import db


cred = credentials.Certificate('ServiceAccountKey.json');

app = Flask(__name__)

def process_video_and_generate_output(url):

    # Cargar el modelo TensorFlow Hub Movenet
    model = hub.load('https://tfhub.dev/google/movenet/multipose/lightning/1')
    movenet = model.signatures['serving_default']

    # Inicialización de variables
    frames = []
    hand_raise_threshold = 2
    right_hip_positions = []
    current_title = 'NO SENAL'
    hand_raised = False
    nose_higher_frames = 0
    frame_count = 0
    frame_buffer = deque(maxlen=10)

    # project_base_path = os.path.join(".")
    data_path = os.path.join("data")
    output_video_path = os.path.join(data_path, 'IMG_8477.MP4')

    gdown.download(url, output_video_path, quiet=False)

    cap = cv2.VideoCapture(output_video_path)
    frames = []
    frame_buffer = []
    frame_count = 0
    nose_higher_frames = 0
    hand_raised = False
    current_title = 'NO SENAL'

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_buffer.append(frame.copy())

        if frame_count % 8 == 0:
            img = tf.image.resize_with_pad(tf.expand_dims(frame, axis=0), 384, 640)
            input_img = tf.cast(img, dtype=tf.int32)

            results = movenet(input_img)
            keypoints_with_scores_raw = results['output_0'].numpy()[:, :, :51].reshape((6, 17, 3))

            loop_through_people(frame, keypoints_with_scores_raw, EDGES, 0.37)
            for person_keypoints in keypoints_with_scores_raw:
                collect_right_hip_positions(person_keypoints, 0.37, right_hip_positions)

            nose_y = keypoints_with_scores_raw[0, 0, 0]
            wrist_y = keypoints_with_scores_raw[0, 10, 0]

            if nose_y > wrist_y:
                nose_higher_frames += 1
                if nose_higher_frames > hand_raise_threshold and not hand_raised:
                    current_title = 'SENAL'
                    hand_raised = True
                    highlight_video_path = os.path.join("output", f"highlight_video_{frame_count}.mp4")
                    save_highlight_video(list(frame_buffer), highlight_video_path)
            else:
                nose_higher_frames = max(0, nose_higher_frames - 1)
                if hand_raised and nose_higher_frames == 0:
                    current_title = 'NO SENAL'
                    hand_raised = False

            cv2.putText(frame, current_title, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            frames.append(frame.copy())

        frame_count += 1

        if cv2.waitKey(10) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    temp_frames_path = os.path.join("temp_frames")
    os.makedirs(temp_frames_path, exist_ok=True)

    for frame_file in os.listdir(temp_frames_path):
        if frame_file.startswith('frame_'):
            os.remove(os.path.join(temp_frames_path, frame_file))

    for i, frame in enumerate(frames):
        cv2.imwrite(os.path.join(temp_frames_path, f"frame_{i}.png"), frame)

    output_video_path = os.path.join("output", "output_video.mp4")
    cmd = f"ffmpeg -framerate 25 -i {os.path.join(temp_frames_path, 'frame_%d.png')} -c:v libx264 -r 30 -pix_fmt yuv420p {output_video_path}"
    subprocess.run(cmd, shell=True, check=True)
    return 'hola desde la funcion'

url = 'https://drive.google.com/uc?id=1nU4WAkDbhcBs9LBTrDSyJKhVGrVsl9_A'

@app.route("/")
def hello():
    res = process_video_and_generate_output(url)
    return res