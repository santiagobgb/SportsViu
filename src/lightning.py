import os
import cv2
import tensorflow as tf
import tensorflow_hub as hub
import numpy as np
from collections import deque
import subprocess
import gdown
from utils import loop_through_people, draw_keypoints, draw_connections, save_highlight_video, collect_right_hip_positions, EDGES

# Cargar el modelo TensorFlow Hub Movenet
model = hub.load('https://tfhub.dev/google/movenet/multipose/lightning/1')
movenet = model.signatures['serving_default']

# Inicialización de variables
frames = []
hand_raised_frames = 0
hand_raise_threshold = 2
right_hip_positions = []
current_title = 'NO SENAL'
hand_raised = False
nose_higher_frames = 0
frame_count = 0
frame_buffer = deque(maxlen=10)

# Definición de rutas
project_base_path = os.path.join("..")
data_path = os.path.join(project_base_path, "data")
output_video_path = os.path.join(data_path, 'IMG_8477.MP4')

# Descargar el video desde Google Drive
url = 'https://drive.google.com/uc?id=1nU4WAkDbhcBs9LBTrDSyJKhVGrVsl9_A'
gdown.download(url, output_video_path, quiet=False)

# Preparación para procesar el video
cap = cv2.VideoCapture(output_video_path)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break  # Termina el bucle si no hay frame para leer

    frame_buffer.append(frame.copy())

    if frame_count % 8 == 0:
        # Preparación de la imagen para la detección
        img = tf.image.resize_with_pad(tf.expand_dims(frame, axis=0), 384, 640)
        input_img = tf.cast(img, dtype=tf.int32)

        # Sección de detección
        results = movenet(input_img)
        keypoints_with_scores_raw = results['output_0'].numpy()[:, :, :51].reshape((6, 17, 3))

        # Llamada a las funciones de utils.py para procesar los keypoints
        loop_through_people(frame, keypoints_with_scores_raw, EDGES, 0.37)
        for person_keypoints in keypoints_with_scores_raw:
            collect_right_hip_positions(person_keypoints, 0.37, right_hip_positions)

        # Lógica adicional para manejar el levantamiento de mano y actualizar el título si es necesario
        nose_y = keypoints_with_scores_raw[0, 0, 0]  # Coordenada y de la nariz
        wrist_y = keypoints_with_scores_raw[0, 10, 0]  # Coordenada y de la muñeca derecha
        if nose_y > wrist_y:
            nose_higher_frames += 1
            if nose_higher_frames > hand_raise_threshold and not hand_raised:
                current_title = 'SENAL'
                hand_raised = True
                highlight_video_path = os.path.join(data_path, f"highlight_video_{frame_count}.mp4")
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


# Ruta a la carpeta temporal donde se guardarán los frames
temp_frames_path = os.path.join("temp_frames")
os.makedirs(temp_frames_path, exist_ok=True)

# Eliminar frames antiguos si existen
for frame_file in os.listdir(temp_frames_path):
    if frame_file.startswith('frame_'):
        os.remove(os.path.join(temp_frames_path, frame_file))

# Guardar los frames actuales como imágenes
for i, frame in enumerate(frames):
    cv2.imwrite(os.path.join(temp_frames_path, f"frame_{i}.png"), frame)

# Convertir imágenes a video
output_video_path = os.path.join("output", "output_video.mp4")
cmd = f"ffmpeg -framerate 25 -i {os.path.join(temp_frames_path, 'frame_%d.png')} -c:v libx264 -r 30 -pix_fmt yuv420p {output_video_path}"

# Usar subprocess para ejecutar el comando ffmpeg
subprocess.run(cmd, shell=True, check=True)

# Cargar la imagen de fondo para visualización
background_image_path = os.path.join("temp_frames", "frame_0.png")  # Ajusta esta ruta según tu estructura de directorio
background_image = cv2.imread(background_image_path)

# Procesar y visualizar las posiciones
# Asume que right_hip_positions contiene las posiciones normalizadas (x, y) de la cadera derecha
# El código para rotar y escalar las coordenadas se mantiene igual

# Aquí se podría llamar a una función de utils.py si tienes una para procesar estas posiciones
# Por simplicidad, se mantiene la lógica aquí según tu descripción
rotated_x = 1 - np.array(right_hip_positions)[:, 1]  # 1 - y original se convierte en x nuevo
rotated_y = np.array(right_hip_positions)[:, 0]      # x original se convierte en y nuevo
scaled_rotated_x = rotated_x * background_image.shape[1]
scaled_rotated_y = rotated_y * background_image.shape[0]

# Visualizar puntos rotados en la imagen de fondo
plt.figure(figsize=(10, 10))
plt.imshow(cv2.cvtColor(background_image, cv2.COLOR_BGR2RGB))
plt.scatter(scaled_rotated_x, scaled_rotated_y, c='yellow', s=1)
plt.axis('off')
plt.title('Players Positions on Game')
plt.show()

SOURCE = np.float32([
    [741, 380],
    [1196, 387],
    [2800, 1079],
    [-1000, 1079]
])

TARGET_WIDTH = 10
TARGET_HEIGHT = 21

TARGET = np.float32([
    [0, 0],
    [TARGET_WIDTH - 1, 0],
    [TARGET_WIDTH - 1, TARGET_HEIGHT - 1],
    [0, TARGET_HEIGHT - 1],
])

# Calcular la matriz de transformación de SOURCE a TARGET
transformation_matrix = cv2.getPerspectiveTransform(SOURCE, TARGET)

# Asumiendo que las posiciones del tobillo derecho se almacenan en scaled_rotated_x y scaled_rotated_y
# Combina en un solo array de coordenadas (x, y)
right_ankle_positions = np.column_stack((scaled_rotated_x, scaled_rotated_y))

# Transforma las posiciones del tobillo usando la matriz de transformación de perspectiva
right_ankle_positions_array = np.float32(right_ankle_positions).reshape(-1, 1, 2)
transformed_ankles = cv2.perspectiveTransform(right_ankle_positions_array, transformation_matrix)
transformed_ankles = transformed_ankles.reshape(-1, 2)

# Carga la imagen de la cancha con vista de pájaro (ajusta la ruta según tu entorno)
court_image_path = "data/court.png"  # Ajusta esta ruta
court_image = cv2.imread(court_image_path)

# Ajusta la escala de los puntos transformados para que se ajusten a las dimensiones de la imagen
scale_x = court_image.shape[1] / TARGET_WIDTH
scale_y = court_image.shape[0] / TARGET_HEIGHT
adjusted_x = transformed_ankles[:, 0] * scale_x
adjusted_y = transformed_ankles[:, 1] * scale_y

# Visualiza las posiciones del tobillo transformadas y ajustadas en la imagen de la cancha
plt.figure(figsize=(10, 10))
plt.imshow(cv2.cvtColor(court_image, cv2.COLOR_BGR2RGB))
plt.scatter(adjusted_x, adjusted_y, c='yellow', s=10)
plt.title('Players Positions on Court (Bird\'s-Eye View)')
plt.axis('off')
plt.show()
