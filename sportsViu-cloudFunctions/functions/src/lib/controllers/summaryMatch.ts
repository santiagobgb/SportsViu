import {streamCollection} from "../../config/firebase";
import {https, Response} from "firebase-functions";

export const summaryMatchController = async (req: https.Request, resp: Response<unknown>): Promise<void> => {
  // const {streamId, streamUrl, timestampsSignal} = Request.body;
  const {streamId} = req.body;

  try {
    // Obtén la referencia del documento usando el streamId
    const streamRef = streamCollection.doc(`${streamId}`);

    // Obtén el documento usando la referencia
    const snapshot = await streamRef.get();

    if (!snapshot.exists) {
      resp.status(404).json({
        status: "error",
        message: "No se encontró el stream",
      });
      return;
    }

    // Verifica si el documento existe
    const data = snapshot.data();

    if (data?.status === "finalizado") {
      resp.status(400).json({
        status: "finalizado",
        messge: "El stream ya esta finalizado revisa el que el id sea correcto",
      });
      return;
    }

    // else
    await streamRef.update({status: "finalizado"});
    resp.status(200).json({
      status: "success",
      message: "Stream finalizado",
      data: data,
    });
    return;
  } catch (error) {
    console.error("Error al buscar el stream:", error);
    resp.status(500).json({
      status: "error",
      message: "Error al buscar el stream",
    });
    return;
  }
};
