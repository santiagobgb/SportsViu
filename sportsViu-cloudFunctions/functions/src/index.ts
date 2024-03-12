import {https, firestore} from "firebase-functions";
import {config} from "dotenv";
import {incompleteUserController} from "./lib/controllers/incompleteUser";
import {summaryMatchController} from "./lib/controllers/summaryMatch";
import whatsMessagesController from "./lib/controllers/whatsMessages";
import {broadcastFinishedTrigger} from "./lib/triggers/broadcastFinished";


config();


export const incompleteUser = https.onRequest(incompleteUserController);
export const summaryMatch = https.onRequest(summaryMatchController);
export const whatsappMessages = https.onRequest(whatsMessagesController);

exports.onStatusChange = firestore
  .document("broadcasts/{documentoId}")
  .onUpdate(broadcastFinishedTrigger);

