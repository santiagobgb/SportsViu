import * as admin from "firebase-admin";
admin.initializeApp();

export const usersCollection = admin.firestore().collection("users");
export const chatsCollection = admin.firestore().collection("chats");
export const broadcastCollection = admin.firestore().collection("broadcasts");
