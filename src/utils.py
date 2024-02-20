def loop_through_people(frame, keypoints, edges, confidence_threshold):
    y, x, c = frame.shape
    for person_keypoints in keypoints:
        person_keypoints = person_keypoints.reshape((17, 3))  # Reshape to the correct format

        for kp in person_keypoints:
            ky, kx, kp_conf = kp[:3]  # Only take the first three values for each keypoint
            if kp_conf > confidence_threshold:
                cv2.circle(frame, (int(kx * x), int(ky * y)), 6, (0, 255, 0), -1)

    draw_connections(frame, keypoints, edges, confidence_threshold)

# Function to draw keypoints on the frame
def draw_keypoints(frame, keypoints, confidence_threshold):
    y, x, c = frame.shape
    shaped = np.multiply(keypoints.reshape((-1, 3)), [y, x, 1])

    for kp in shaped:
        ky, kx, kp_conf = kp[:3]
        if kp_conf > confidence_threshold:
            cv2.circle(frame, (int(kx), int(ky)), 6, (0, 255, 0), -1)

EDGES = {
    (0, 1): (255, 0, 0),  # Red
    (0, 2): (0, 255, 255),  # Cyan
    (1, 3): (255, 0, 0),  # Red
    (2, 4): (0, 255, 255),  # Cyan
    (0, 5): (255, 0, 0),  # Red
    (0, 6): (0, 255, 255),  # Cyan
    (5, 7): (255, 0, 0),  # Red
    (7, 9): (255, 0, 0),  # Red
    (6, 8): (0, 255, 255),  # Cyan
    (8, 10): (0, 255, 255),  # Cyan
    (5, 6): (255, 255, 0),  # Yellow
    (5, 11): (255, 0, 0),  # Red
    (6, 12): (0, 255, 255),  # Cyan
    (11, 12): (255, 255, 0),  # Yellow
    (11, 13): (255, 0, 0),  # Red
    (13, 15): (255, 0, 0),  # Red
    (12, 14): (0, 255, 255),  # Cyan
    (14, 16): (0, 255, 255)  # Cyan
}

def draw_keypoints(frame, keypoints, confidence_threshold):
    y, x, c = frame.shape

    # Assuming the structure of each person's keypoints is [x1, y1, s1, x2, y2, s2, ..., x17, y17, s17]
    for person_keypoints in keypoints[0]:
        person_keypoints = person_keypoints.reshape((17, 3))

        for i in range(0, 56, 3):
            kx, ky, kp_conf = person_keypoints[:, i:i+3].T

            valid_keypoints = kp_conf > confidence_threshold
            valid_keypoints_indices = np.where(valid_keypoints)[0]

            for idx in valid_keypoints_indices:
                cv2.circle(frame, (int(kx[idx] * x), int(ky[idx] * y)), 6, (0, 255, 0), -1)

def draw_connections(frame, keypoints, edges, confidence_threshold):
    """
    Draw connections between keypoints on the frame.

    Args:
    - frame: The input frame.
    - keypoints: Detected keypoints with their confidence scores.
    - edges: A dictionary defining the connections between keypoints.
    - confidence_threshold: Minimum confidence score to consider for drawing connections.
    """
    h, w, _ = frame.shape

    for edge, color in edges.items():
        p1, p2 = edge
        y1, x1, c1 = keypoints[0, p1]
        y2, x2, c2 = keypoints[0, p2]

        if c1 > confidence_threshold and c2 > confidence_threshold:
            # Convert color values to integers
            color = (int(color[0]), int(color[1]), int(color[2]))

            cv2.line(frame, (int(x1 * w), int(y1 * h)), (int(x2 * w), int(y2 * h)), color, 2)
            cv2.circle(frame, (int(x1 * w), int(y1 * h)), 5, color, -1)
            cv2.circle(frame, (int(x2 * w), int(y2 * h)), 5, color, -1)

# Function to save highlight video using ffmpeg
def save_highlight_video(frames, output_path):
    # Write frames to temporary directory
    temp_dir = '/content/temp_frames/'
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)
    for i, frame in enumerate(frames):
        cv2.imwrite(os.path.join(temp_dir, f"frame_{i}.png"), frame.copy())

    # Use ffmpeg to create video
    cmd = f"ffmpeg -framerate 25 -i {temp_dir}/frame_%d.png -c:v libx264 -r 30 -pix_fmt yuv420p {output_path}"
    subprocess.call(cmd, shell=True)

    # Clean up temporary frames
    shutil.rmtree(temp_dir)

def collect_right_hip_positions(person_keypoints, confidence_threshold, right_hip_positions):
    person_keypoints = person_keypoints.reshape((17, 3))  # Assuming COCO model format
    right_hip = person_keypoints[16]  # Index 16 for right anckle
    rh_confidence = right_hip[2]

    if rh_confidence > confidence_threshold:
        # Only add position if confidence is high enough
        right_hip_positions.append(right_hip[:2])  # Append (x, y) of the right hip

