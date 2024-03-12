import {usersCollection} from "../../config/firebase";
import {https, Response} from "firebase-functions";


export const incompleteUserController = async (req: https.Request, resp: Response<unknown>): Promise<void> => {
  const {phoneNumber, name} = req.body;

  if (!phoneNumber || !name) {
    resp.status(404).json({
      status: "Failed",
      message: "Faltan datos numero de telefono o nombre del usuario",
    });
    return;
  }

  try {
    const queryPhoneNumber = await usersCollection
      .where("phone_number", "==", phoneNumber)
      .limit(1)
      .get();

    const userRef = queryPhoneNumber.docs[0].ref;

    if (queryPhoneNumber.docs[0].data().status === "incomplete") {
      await userRef.update({
        display_name: name,
        status: "complete",
      });
      console.log("Entre al  incomplete despues del update");
      resp.status(201).json({
        status: "Ok",
        message: "Los datos del usuario se completaron correctamente",
      });
      return;
    }

    resp.status(200).json({
      status: "ok",
      message: "Todos los datos del usuario ya estaban completados",
    });
    return;
  } catch (error) {
    resp.status(404).json({
      status: "Error",
      message: "Registro no encontrado",
    });
    return;
  }
};
