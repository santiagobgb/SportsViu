import {broadcastCollection} from "../../config/firebase";
import {https, Response} from "firebase-functions";

export const summaryMatchController = async (req: https.Request, resp: Response<unknown>): Promise<void> => {
  // const {broadcastId, broadcastUrl, timestampsSignal} = Request.body;
  const {broadcastId} = req.body;

  try {
    // Obtén la referencia del documento usando el broadcastId
    const broadcastRef = broadcastCollection.doc(`${broadcastId}`);

    // Obtén el documento usando la referencia
    const snapshot = await broadcastRef.get();

    if (!snapshot.exists) {
      resp.status(404).json({
        status: "error",
        message: "No se encontró el broadcast",
      });
      return;
    }

    // Verifica si el documento existe
    const data = snapshot.data();

    if (data?.status === "finalizado") {
      resp.status(400).json({
        status: "finalizado",
        messge: "El broadcast ya esta finalizado revisa el que el id sea correcto",
      });
      return;
    }

    // else
    await broadcastRef.update({status: "finalizado"});
    resp.status(200).json({
      status: "success",
      message: "Stream finalizado",
      data: data,
    });
    return;
  } catch (error) {
    console.error("Error al buscar el broadcast:", error);
    resp.status(500).json({
      status: "error",
      message: "Error al buscar el broadcast",
    });
    return;
  }
};
