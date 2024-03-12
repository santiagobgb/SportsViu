import {info, error} from "firebase-functions/logger";
import openAiInstance from "../config/openai";
import {chatsCollection} from "../config/firebase";
import {sendWhatsappMessage} from "./whatsapp";
import {FieldValue} from "@google-cloud/firestore";
import {delay} from "../utils";


export const processThread = async (
  threadId: string,
  runId: string,
  userPhoneNumber: string,
): Promise<string> => {
  try {
    let runRetrieve = await openAiInstance.beta.threads.runs.retrieve(
      threadId,
      runId,
    );
    info("Answer status: ", runRetrieve.status);
    let timeOut = 1000;
    while (runRetrieve.status === "in_progress" || runRetrieve.status === "queued") {
      runRetrieve = await openAiInstance.beta.threads.runs.retrieve(
        threadId,
        runId,
      );
      info("Answer status: ", runRetrieve.status);
      if (runRetrieve.status === "failed") {
        info("lifecycle failed");
        return "Error: lifecycle failed";
      }
      if (runRetrieve.status === "expired") {
        info("lifecycle expired");
        return "Error: lifecycle expired";
      }

      if (runRetrieve.status === "completed") {
        const limit = 5;
        const messages = await openAiInstance.beta.threads.messages.list(
          threadId,
          {limit},
        );
        const firstMessageContent = messages.data[0]?.content[0];
        info(firstMessageContent);
        if (firstMessageContent && firstMessageContent.type === "text") {
          const assistantResponse = firstMessageContent.text.value.replace(
            /【.*】/g,
            "",
          );

          await chatsCollection.doc(userPhoneNumber).update({
            conversation: FieldValue.arrayUnion({
              role: "bot",
              content: assistantResponse,
              time: new Date().toLocaleString(),
            }),
            updated: new Date().toLocaleString(),
          });


          await sendWhatsappMessage(userPhoneNumber, assistantResponse);
        } else {
          await sendWhatsappMessage(
            userPhoneNumber,
            "No se pudo generar una respuesta",
          );
        }
        return "Retrieve: Completed";
      }

      await delay(timeOut);
      timeOut = timeOut + 300;
    }

    return "ok";
  } catch (err) {
    error("Error al procesar el Thread:", err);
    return "Error processing thread";
  }
};
