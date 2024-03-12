import {FieldValue} from "firebase-admin/firestore";
import {usersCollection, broadcastCollection} from "../../config/firebase";


export const postBroadcastNewMember = async (
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
    // verifica si existe el numero de telefono
    const queryPhoneNumber = await usersCollection
      .where("phone_number", "==", phoneNumber)
      .limit(1)
      .get();

    // obtiene la referencia del broadcast
    console.log("searching for broadcast", broadcastId);
    const broadcastRef = broadcastCollection .doc(broadcastId.trim());

    // Verifica si la referencia del usuario existe en el array de referencias de broadcastData
    const userRef = queryPhoneNumber.docs[0]?.ref;

    if (queryPhoneNumber.size > 0) {
      // obtiene el documento de broadcast
      const broadcastData = (await broadcastRef.get()).data();

      if (broadcastData?.members?.some((ref: any) => ref.isEqual(userRef))) {
        return {
          status: "Exist",
          message: `Hola ${
            name ?? "Usuario"
          }, ya contabas con el registro en la transmisión. Al finalizar el partido, recibirás un resumen. :)`,
        };
      } else {
        const updatedMembers = (broadcastData?.members || []).concat(userRef);

        // Actualiza el documento de broadcast con el nuevo array de members
        await broadcastRef.update({members: updatedMembers});

        // Agrega una referencia al array 'broadcasts'
        await userRef.update({
          broadcast_id: FieldValue.arrayUnion(broadcastRef),
        });

        return {
          status: "Ok",
          message: `Hola ${
            name ?? "Usuario"
          } La inscripción ha quedado completada. La URL del stream es: (${
            broadcastData?.url ?? ""
          }). Al finalizar el partido, recibirás un resumen.`,
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
      await memberRef.update({id: newMember.id});

      // obtiene el documento de broadcast
      const broadcastData = (await broadcastRef.get()).data();

      // Agrega el documentRef del nuevo miembro a la lista 'users' en el documento de 'broadcast'

      await broadcastCollection
        .doc(broadcastRef.id)
        .update({
          members: FieldValue.arrayUnion(memberRef),
        });

      return {
        status: "Ok",
        message: `Hola ${
          name ?? "Usuario"
        } inscripción ha quedado completada. La URL del stream es: (${
          broadcastData?.url || ""
        }). Al finalizar el partido, recibirás un resumen.`,
        member_id: memberRef.id,
        datos_pendientes: name ?
          false :
          "Hola sportviuer falta actualizar el nombre de usuario",
      };
    }
  } catch (err) {
    console.log("error", err);
    return {
      status: "Failed",
      message: `Hola ${name}, no se identificó ese partido; es posible que haya un error en el ID del broadcast :)`,
    };
  }
};
