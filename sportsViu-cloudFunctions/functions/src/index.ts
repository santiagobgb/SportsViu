import {https, firestore} from "firebase-functions";
import {config} from "dotenv";
import whatsMessagesController from "./lib/controllers/whatsMessages";
import {streamFinishedTrigger} from "./lib/triggers/streamsFinished";


config();


// export const incompleteUser = https.onRequest(incompleteUserController);
// export const summaryMatch = https.onRequest(summaryMatchController);
export const whatsappMessages = https.onRequest(whatsMessagesController);

exports.onStatusChange = firestore
  .document("streams/{documentoId}")
  .onUpdate(streamFinishedTrigger);

