import axios from "axios";
import {info, error, warn} from "firebase-functions/logger";
import {PHONE_NO_ID, WA_TOKEN} from "../config/whatsapp";

interface WhatsAppMessage {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts: {
          profile: {
            name: string;
          };
          wa_id: string;
        }[];
        messages?: {
          context?: {
            from: string,
            id: string
          },
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          button?: {
            text: string;
            payload: string;
          };
          interactive?: {
            type: string;
            nfm_reply?: {
              response_json: string
            }
          };
          type: "text" | "button" | "image" | "interactive";
          image?: {
            caption?: string,
            mime_type: string,
            sha256: string,
            id: string
          }
        }[];
        statuses?: { id: string }[];
      };
      field: string;
    }[];
  }[];
}
interface LocalWhatsAppMessage {
  id: string;
  context?: {
    from: string,
    id: string
  }
  messageInfo: {
    content: string;
    type: string;
    time: string;
    role: string;
  };
  // name: string;
  userPhoneNumber: string;
  botPhoneNumber: string;
}

export const sendWhatsappMessage = async (
  phoneNumber: string,
  message: string,
) => {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${WA_TOKEN}`,
  };

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: `${phoneNumber}`,
    type: "text",
    text: {
      preview_url: "false",
      body: message,
    },
  };


  const url = `https://graph.facebook.com/v18.0/${PHONE_NO_ID?.toString()}/messages`;

  try {
    const response = await axios.post(url, data, {headers});

    return {
      status: "Ok",
      message: "Se envio el mensaje exitosamente",
      data: response.data,
    };
  } catch (error: any) {
    console.error("Error en la solicitud:", error.message);
    console.log(error.config);
    return {
      status: "Error",
      message: "Error al enviar el mensaje al usuario",
      data: error.message,
    };
  }
};

export const sendWhatsappImage = async (
  phoneNumber: string,
  imageLink: string
) => {
  if (imageLink === "") {
    warn("No se ha proporcionado un link de imagen");
    return {
      status: "Error",
      message: "Error al enviar el mensaje al usuario",
      data: "No se ha proporcionado un link de imagen",
    };
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${WA_TOKEN}`,
  };

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: `${phoneNumber}`,
    type: "image",
    image: {
      link: imageLink,
    },
  };


  const url = `https://graph.facebook.com/v18.0/${PHONE_NO_ID?.toString()}/messages`;

  try {
    const response = await axios.post(url, data, {headers});

    // console.log("Respuesta exitosa:", response.data);
    return {
      status: "Ok",
      message: "Se envio el mensaje exitosamente",
      data: response.data,
    };
  } catch (error: any) {
    console.error("Error en la solicitud:", error.message);
    console.log(error.config);
    return {
      status: "Error",
      message: "Error al enviar el mensaje al usuario",
      data: error.message,
    };
  }
};

export const sendWhatsappVideo = async (
  phoneNumber: string,
  videoLink: string,
  caption: string
) => {
  if (videoLink === "") {
    warn("No se ha proporcionado un link del video");
    return {
      status: "Error",
      message: "Error al enviar el mensaje al usuario",
      data: "No se ha proporcionado un link de video",
    };
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${WA_TOKEN}`,
  };

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: `${phoneNumber}`,
    type: "video",
    video: {
      link: videoLink,
      caption,
    },
  };


  const url = `https://graph.facebook.com/v18.0/${PHONE_NO_ID?.toString()}/messages`;

  try {
    const response = await axios.post(url, data, {headers});

    // console.log("Respuesta exitosa:", response.data);
    return {
      status: "Ok",
      message: "Se envio el mensaje exitosamente",
      data: response.data,
    };
  } catch (error: any) {
    console.error("Error en la solicitud:", error.message);
    console.log(error.config);
    return {
      status: "Error",
      message: "Error al enviar el mensaje al usuario",
      data: error.message,
    };
  }
};

export const isNotification = async (
  body: WhatsAppMessage,
): Promise<boolean> => {
  try {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (!change.value.messages) {
          // no message its a notification
          info("Notification received, skipping");
          return true;
        }
      }
    }
  } catch (err) {
    error("isNotification failed", err);
    return false;
  }
  return false;
};


export const filterMessageData = (
  body: WhatsAppMessage
  // body bot number
): LocalWhatsAppMessage => {
  let botPhoneNumber = "";
  let userPhoneNumber = "";
  let localMessage;
  let context;
  let id = "";
  try {
    for (const entry of body.entry) {
      // info("Message entry", entry);
      for (const change of entry.changes) {
        if (!change.value.messages) {
          continue;
        }
        // info("Message change", change);

        for (const message of change.value.messages) {
          // info("Message received", message);

          if (message.context) {
            // info("Message context", message.context);
            context = {
              from: message.context.from,
              id: message.context.id,
            };
          }

          userPhoneNumber = message.from;
          botPhoneNumber = change.value.metadata.display_phone_number;
          id = message.id;
          localMessage = message;

          if (
            message.type !== "text" &&
            message.type !== "button" &&
            message.type !== "interactive" &&
            message.type !== "image"
          ) {
            warn(
              "Message type not allowed",
              message.type,
              "for",
              userPhoneNumber,
              "to",
              botPhoneNumber
            );
            return {
              messageInfo: {
                content: "not-allowed",
                type: localMessage?.type || "",
                time: localMessage?.timestamp || "",
                role: "user",
              },
              id,
              userPhoneNumber,
              botPhoneNumber,
            };
          } else {
            // its allowed
            let messageInfo;

            // if (message.type === "image") {
            //   messageInfo = {
            //     content: JSON.stringify({
            //       caption: message.image?.caption,
            //       id: message.image?.id,
            //     }),
            //     type: message.type,
            //     time: message.timestamp,
            //     role: "user",
            //   };
            // } else
            if (
              message.type === "interactive" &&
              message.interactive?.type === "nfm_reply"
            ) {
              messageInfo = {
                content: message.interactive?.nfm_reply?.response_json ?? "",
                type: message.type,
                time: message.timestamp,
                role: "user",
              };
            } else {
              messageInfo = {
                content: getTextFromMessage(message as any),
                type: message.type,
                time: message.timestamp,
                role: "user",
              };
            }

            info(
              "Message allowed",
              messageInfo,
              userPhoneNumber,
              botPhoneNumber
            );

            return {
              context,
              messageInfo,
              userPhoneNumber,
              botPhoneNumber,
              id,
            };
          }
        }
      }
    }
  } catch (err) {
    error("isAllowedTypeMessage failed", err);
  }
  return {
    messageInfo: {
      // TODO handle this as failed message
      content: "not-allowed",
      type: localMessage?.type || "",
      time: localMessage?.timestamp || "",
      role: "user",
    },
    id,
    userPhoneNumber,
    botPhoneNumber,
  };
};

const getTextFromMessage = (messages?: {
  text?: {
    body: string;
  };
  button?: {
    text: string;
    payload: string;
  };
  interactive?: {
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
    };
  };
  type: "text" | "button" | "interactive";
}): string => {
  if (messages?.type === "button") {
    return messages.button?.text || "";
  }
  if (messages?.type === "text") {
    return messages.text?.body || "";
  }
  if (messages?.type === "interactive") {
    if (messages.interactive?.button_reply) {
      return messages.interactive?.button_reply.title;
    }
    if (messages.interactive?.list_reply) {
      return messages.interactive?.list_reply.title;
    }
  }
  return "";
};

