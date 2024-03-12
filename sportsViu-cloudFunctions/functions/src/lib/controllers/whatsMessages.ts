import * as express from "express";
import * as cors from "cors";
import {FieldValue} from "firebase-admin/firestore";
import {chatsCollection} from "../../config/firebase";
import openAiInstance from "../../config/openai";
import {processThread} from "../openai";
import {postBroadcastNewMember} from "./postBroadcastNewMember";
import {filterMessageData, isNotification, sendWhatsappMessage} from "../whatsapp";

const whatsMessagesController = express();
whatsMessagesController.use(cors({origin: true}));

// Verification token
whatsMessagesController.get("/webhook", (Request, Response) => {
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

whatsMessagesController.post("/webhook", async (Request, Response) => {
  const bodyParam = Request.body;

  const isNotif = await isNotification(bodyParam);
  if (isNotif) {
    return Response.sendStatus(200);
  }

  const localMessage = filterMessageData(bodyParam);

  const from = localMessage.userPhoneNumber;
  const msgBody = localMessage.messageInfo.content;
  const name = bodyParam.entry[0].changes[0].value.contacts[0].profile.name;

  if (msgBody.includes("broadcastId:")) {
    const broadcastId = msgBody.split("broadcastId:").filter(Boolean);
    const responsePostVroadcast = await postBroadcastNewMember(
      from,
      broadcastId[0].trim(),
      name
    );
    await sendWhatsappMessage(from, responsePostVroadcast.message);
    return Response.sendStatus(200);
  }

  if (msgBody.includes("reset")) {
    await chatsCollection.doc(from).delete();
    await sendWhatsappMessage(from, "Se ha reiniciado la conversación");
    return Response.sendStatus(200);
  }

  // else
  // verifica si existe el numero de telefono
  const queryPhoneNumber = await chatsCollection.doc(from).get();
  const chatRef = chatsCollection.doc(from);

  if (!queryPhoneNumber.exists) {
    const thread = await openAiInstance.beta.threads.create();
    await openAiInstance.beta.threads.messages.create(thread.id, {
      role: "user",
      content: msgBody,
    });

    await chatsCollection.doc(from).set({
      conversation: FieldValue.arrayUnion({
        role: "user",
        content: msgBody,
      }),
      updated: new Date().toLocaleString(),
      thread_id: thread.id,
    });


    const run = await openAiInstance.beta.threads.runs.create(thread.id, {
      assistant_id: "asst_hBKzosqSsoWfRSgQHOZrabVB",
    });
    await processThread(thread.id, run.id, from);
    return Response.sendStatus(200);
  }

  // else already exists
  const existingUser = queryPhoneNumber.data();
  await chatRef.update({
    conversation: FieldValue.arrayUnion({
      role: "user",
      content: msgBody,
      time: new Date().toLocaleString(),
    }),
    updated: new Date().toLocaleString(),
  });
  const threadId = existingUser!.thread_id;
  await openAiInstance.beta.threads.messages.create(threadId, {
    role: "user",
    content: msgBody,
  });

  const run = await openAiInstance.beta.threads.runs.create(threadId, {
    assistant_id: "asst_hBKzosqSsoWfRSgQHOZrabVB",
  });
  await processThread(threadId, run.id, from);
  return Response.sendStatus(200);
});

export default whatsMessagesController;
