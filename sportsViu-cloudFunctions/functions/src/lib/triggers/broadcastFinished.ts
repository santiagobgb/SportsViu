import {firestore} from "firebase-admin";
import {Change} from "firebase-functions/v1";
import {sendWhatsappImage, sendWhatsappVideo} from "../whatsapp";
import {info, warn} from "firebase-functions/logger";

export const broadcastFinishedTrigger = async (
  change: Change<firestore.QueryDocumentSnapshot>,
  // context: EventContext<{
  //   documentoId: string;
  // }>
) => {
  const newData = change.after.data();
  // Verifica si el campo 'status' ha cambiado
  info("Broadcast  trigger", newData.status);

  if (newData.status === "finalizado") {
    // Accede al array de referencias
    const referens = newData.members;
    info("Sending messages to", referens.length, "users");

    // Itera sobre las referencias y obtén los documentos referenciados de forma secuencial
    for (const ref of referens) {
      let user = await ref.get();
      user = user.data();
      info("Sending messages to", user.phone_number);

      if (newData.highlight_videos_url) {
        // Highlight videos
        info("Sending highlight videos", newData.highlight_videos_url.length);
        let counter = 0;
        for (const video of newData.highlight_videos_url) {
          await sendWhatsappVideo(
            user.phone_number,
            video,
            `Highlight ${++counter}`
          );
        }
      } else {
        warn("No highlight videos found");
      }


      if (newData.heatmap_images_url) {
        // Heat map images
        info("Sending heat map images", newData.heatmap_images_url.length);
        for (const image of newData.heatmap_images_url) {
          await sendWhatsappImage(
            user.phone_number,
            image
          );
        }
      } else {
        warn("No heat map images found");
      }

      if (newData.final_video_url) {
        // url
        info("Sending final video");
        await sendWhatsappVideo(
          user.phone_number,
          newData.final_video_url,
          "Video final"
        );
      } else {
        warn("No final video found");
      }
    }
  }

  return null;
};
