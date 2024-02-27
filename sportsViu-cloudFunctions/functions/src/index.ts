import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue } from "@google-cloud/firestore";
import axios from "axios";
import * as express from "express";
import * as cors from "cors";
import { config } from "dotenv";

config();

const app = express();

admin.initializeApp();

app.use(cors({ origin: true }));

const postBroadcastNewMember = async (
  phoneNumber: string,
  broadcastId: string,
  name: string
): Promise<any> => {
  if (!phoneNumber || !broadcastId) {
    return {
      status: "Failed",
      message: "Faltan datos numero de telefono o id de broadcast",
    };
  }

  try {
    // obtiene la coleccion de miembros
    const usersCollection = admin.firestore().collection("users");

    // verifica si existe el numero de telefono
    const queryPhoneNumber = await usersCollection
      .where("phone_number", "==", phoneNumber)
      .get();

    // obtiene la referencia del broadcast
    const broadcastRef = admin
      .firestore()
      .collection("broadcasts")
      .doc(broadcastId);

    // Verifica si la referencia del usuario existe en el array de referencias de broadcastData
    const userRef = queryPhoneNumber.docs[0]?.ref;

    if (queryPhoneNumber.size > 0) {
      // obtiene el documento de broadcast
      const broadcastData = (await broadcastRef.get()).data();

      if (broadcastData?.members.some((ref: any) => ref.isEqual(userRef))) {
        return {
          status: "Exist",
          message: `Hola ${
            name ?? "Usuario"
          }, ya contabas con el registro en la transmisión. Al finalizar el partido, recibirás un resumen. :)`,
        };
      } else {
        const updatedMembers = (broadcastData?.members || []).concat(userRef);

        // Actualiza el documento de broadcast con el nuevo array de members
        await broadcastRef.update({ members: updatedMembers });

        // Agrega una referencia al array 'broadcasts'
        await userRef.update({
          broadcast_id: FieldValue.arrayUnion(broadcastRef),
        });

        return {
          status: "Ok",
          message: `Hola ${
            name ?? "Usuario"
          } La inscripción ha quedado completada. La URL del stream es: (${
            broadcastData?.url
          }). Al finalizar el partido, recibirás un resumen. :)`,
        };
      }
    } else {
      const newMember = {
        display_name: name ? name : "",
        phone_number: phoneNumber,
        broadcast_id: broadcastRef ? [broadcastRef] : [],
        status: name ? "complete" : "incomplete",
        created_time: FieldValue.serverTimestamp(),
      } as { id?: string };

      // Agrega el nuevo miembro a la colección 'users'
      const memberRef = await usersCollection.add(newMember);

      // Agrega el id al usuario
      newMember.id = memberRef.id;
      await memberRef.update({ id: newMember.id });

      // obtiene el documento de broadcast
      const broadcastData = (await broadcastRef.get()).data();

      // Agrega el documentRef del nuevo miembro a la lista 'users' en el documento de 'broadcast'

      await admin
        .firestore()
        .collection("broadcasts")
        .doc(broadcastRef.id)
        .update({
          members: FieldValue.arrayUnion(memberRef),
        });

      return {
        status: "Ok",
        message: `Hola ${
          name ?? "Usuario"
        } inscripción ha quedado completada. La URL del stream es: (${
          broadcastData?.url
        }). Al finalizar el partido, recibirás un resumen. :)`,
        member_id: memberRef.id,
        datos_pendientes: name
          ? false
          : "Hola sportviuer falta actualizar el nombre de usuario",
      };
    }
  } catch (error) {
    return {
      status: "Failed",
      message: `Hola ${name}, no se identificó ese partido; es posible que haya un error en el ID del broadcast :)`,
    };
  }
};

export const incompleteUser = functions.https.onRequest(
  async (Request: any, Response: any) => {
    const { phoneNumber, name } = Request.body;

    if (!phoneNumber || !name) {
      return Response.status(404).json({
        status: "Failed",
        message: "Faltan datos numero de telefono o nombre del usuario",
      });
    }

    try {
      const usersCollection = admin.firestore().collection("users");

      const queryPhoneNumber = await usersCollection
        .where("phone_number", "==", phoneNumber)
        .get();

      const userRef = queryPhoneNumber.docs[0].ref;

      if (queryPhoneNumber.docs[0].data().status === "incomplete") {
        await userRef.update({
          display_name: name,
          status: "complete",
        });
        console.log("Entre al  incomplete despues del update");
        return Response.status(201).json({
          status: "Ok",
          message: "Los datos del usuario se completaron correctamente",
        });
      } else {
        return Response.status(200).json({
          status: "ok",
          message: "Todos los datos del usuario ya estaban completados",
        });
      }
    } catch (error) {
      Response.status(404).json({
        status: "Error",
        message: "Registro no encontrado",
      });
    }
  }
);

export const summaryMatch = functions.https.onRequest(
  async (Request: any, Response: any) => {
    // const {broadcastId, broadcastUrl, timestampsSignal} = Request.body;
    const { broadcastId } = Request.body;

    try {
      // Obtén la referencia del documento usando el broadcastId
      const broadcastRef = admin.firestore().doc(`broadcasts/${broadcastId}`);

      // Obtén el documento usando la referencia
      const snapshot = await broadcastRef.get();

      // Verifica si el documento existe
      if (snapshot.exists) {
        const data = snapshot.data();

        if (data?.status === "finalizado") {
          return Response.status(400).json({
            status: "finalizado",
            messge:
              "El broadcast ya esta finalizado revisa el que el id sea correcto",
          });
        } else {
          await broadcastRef.update({ status: "finalizado" });
          return Response.status(200).json({
            status: "success",
            message: "Stream finalizado",
            data: data,
          });
        }
      } else {
        return Response.status(404).json({
          status: "error",
          message: "No se encontró el broadcast",
        });
      }
    } catch (error) {
      console.error("Error al buscar el broadcast:", error);
      Response.status(500).json({
        status: "error",
        message: "Error al buscar el broadcast",
      });
    }
  }
);

const sendWhatsappMessage = async (
  phoneNumber: string,
  message: string,
  videoUrl?: string
) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TOKEN}`,
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

  const dataVideo = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: `${phoneNumber}`,
    type: "video",
    video: {
      link: videoUrl,
      caption: message,
    },
  };

  const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NO_ID}/messages `;

  try {
    if (videoUrl) {
      const response = await axios.post(url, dataVideo, { headers });

      console.log("Respuesta exitosa:", response.data);

      return {
        status: "Ok",
        message: "Se envio el mensaje exitosamente",
        data: response.data,
      };
    }

    const response = await axios.post(url, data, { headers });

    console.log("Respuesta exitosa:", response.data);
    return {
      status: "Ok",
      message: "Se envio el mensaje exitosamente",
      data: response.data,
    };
  } catch (error: any) {
    console.error("Error en la solicitud:", error.message);
    return {
      status: "Error",
      message: "Error al enviar el mensaje al usuario",
      data: error.message,
    };
  }
};

app.get("/webhook", (Request, Response) => {
  const challenge = Request.query["hub.challenge"];
  const token = Request.query["hub.verify_token"];

  const mytoken = "sportsviu";

  if (token) {
    if (token === mytoken) {
      Response.status(200).send(challenge);
    } else {
      Response.status(403);
    }
  }
});

app.post("/webhook", async (Request, Response) => {
  const bodyParam = Request.body;
  if (bodyParam.object) {
    const from = bodyParam.entry[0].changes[0].value.messages[0].from;
    const msgBody = bodyParam.entry[0].changes[0].value.messages[0].text.body;
    const name = bodyParam.entry[0].changes[0].value.contacts[0].profile.name;

    if (msgBody.includes("broadcastId:")) {
      const broadcastId = msgBody.split("broadcastId:").filter(Boolean);
      const responsePostVroadcast = await postBroadcastNewMember(
        from,
        broadcastId[0],
        name
      );
      await sendWhatsappMessage(from, responsePostVroadcast.message);
      Response.sendStatus(200);
    } else {
      const message = "Hola desde sportsviu";
      await sendWhatsappMessage(from, message);
      Response.sendStatus(200);
    }
  } else {
    Response.sendStatus(400);
  }
});

exports.onStatusChange = functions.firestore
  .document("broadcasts/{documentoId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    // Verifica si el campo 'status' ha cambiado

    if (newData.status === "finalizado") {
      // Accede al array de referencias
      const referens = newData.members;

      // Almacena los documentos referenciados
      const documentsRef = [];

      // Itera sobre las referencias y obtén los documentos referenciados de forma secuencial
      for (const ref of referens) {
        const documentRef = await ref.get();
        documentsRef.push(documentRef.data());
        await sendWhatsappMessage(
          documentRef.data().phone_number,
          "video de prueba",
          "https://upcdn.io/W142iJs/raw/uploads/2024/01/22/4ksUp4XADZ-media_1705961151658.mp4"
        );
      }
    }

    return null;
  });

export const whatsappMessages = functions.https.onRequest(app);
