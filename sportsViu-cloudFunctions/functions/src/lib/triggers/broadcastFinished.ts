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
  const previousValue = change.before.data();

  const newKeys = Object.keys(newData);
  const oldKeys = Object.keys(previousValue);

  const changes = newKeys.filter((clave) => !oldKeys.includes(clave));

  if (!( changes.includes("highlight_videos_url") || changes.includes("heatmap_images_url") || changes.includes("final_video_url"))) {
    info("The update was not relevant");
    return;
  }

  const referens = newData.members;

  for (const ref of referens) {
    let user = await ref.get();
    user = user.data();

    info("Sending messages to", user.phone_number);

    if (changes.includes("highlight_videos_url")) {
      if (typeof newData.highlight_videos_url === "string") {
        warn("Highlight videos is a string");
        continue;
      }

      let counter = 0;
      for (const video of newData.highlight_videos_url) {
        console.log("Sending video", video);
        await sendWhatsappVideo(
          user.phone_number,
          video,
          `Highlight [${++counter}]`
        );
      }
    }


    if (changes.includes("heatmap_images_url")) {
      if (typeof newData.heatmap_images_url === "string") {
        warn("Heat map images is a string");
        continue;
      }
      // Heat map images
      info("Sending heat map images", newData.heatmap_images_url.length);
      for (const image of newData.heatmap_images_url) {
        console.log("Sending image", image);
        await sendWhatsappImage(
          user.phone_number,
          image
        );
      }
    }

    if (changes.includes("final_video_url")) {
      // url
      info("Sending final video");
      await sendWhatsappVideo(
        user.phone_number,
        newData.final_video_url,
        "Video final"
      );
    }
  }
};
