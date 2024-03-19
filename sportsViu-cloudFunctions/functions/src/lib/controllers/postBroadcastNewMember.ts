import {FieldValue} from "firebase-admin/firestore";
import {usersCollection, streamCollection} from "../../config/firebase";


export const postBroadcastNewMember = async (
  phoneNumber: string,
  streamId: string,
  name: string
): Promise<any> => {
  if (!phoneNumber || !streamId) {
    return {
      status: "Failed",
      message: "Faltan datos numero de telefono o id de stream",
    };
  }

  try {
    // verifica si existe el numero de telefono
    const queryPhoneNumber = await usersCollection
      .where("phone_number", "==", phoneNumber)
      .limit(1)
      .get();

    // obtiene la referencia del stream
    console.log("searching for stream", streamId);
    const streamRef = streamCollection .doc(streamId.trim());

    // Verifica si la referencia del usuario existe en el array de referencias de streamData
    const userRef = queryPhoneNumber.docs[0]?.ref;

    if (queryPhoneNumber.size > 0) {
      // obtiene el documento de stream
      const streamData = (await streamRef.get()).data();

      if (streamData?.members?.some((ref: any) => ref.isEqual(userRef))) {
        return {
          status: "Exist",
          message: `Hola ${
            name ?? "Usuario"
          }, ya contabas con el registro en la transmisión. Al finalizar el partido, recibirás un resumen. :)`,
        };
      } else {
        const updatedMembers = (streamData?.members || []).concat(userRef);

        // Actualiza el documento de stream con el nuevo array de members
        await streamRef.update({members: updatedMembers});

        // Agrega una referencia al array 'streams'
        await userRef.update({
          stream_id: FieldValue.arrayUnion(streamRef),
        });

        return {
          status: "Ok",
          message: `Hola ${
            name ?? "Usuario"
          } La inscripción ha quedado completada. La URL del stream es: (${
            streamData?.url ?? ""
          }). Al finalizar el partido, recibirás un resumen.`,
        };
      }
    } else {
      const newMember = {
        display_name: name ? name : "",
        phone_number: phoneNumber,
        stream_id: streamRef ? [streamRef] : [],
        status: name ? "complete" : "incomplete",
        created_time: FieldValue.serverTimestamp(),
      } as { id?: string };

      // Agrega el nuevo miembro a la colección 'users'
      const memberRef = await usersCollection.add(newMember);

      // Agrega el id al usuario
      newMember.id = memberRef.id;
      await memberRef.update({id: newMember.id});

      // obtiene el documento de stream
      const streamData = (await streamRef.get()).data();

      // Agrega el documentRef del nuevo miembro a la lista 'users' en el documento de 'stream'

      await streamCollection
        .doc(streamRef.id)
        .update({
          members: FieldValue.arrayUnion(memberRef),
        });

      return {
        status: "Ok",
        message: `Hola ${
          name ?? "Usuario"
        } inscripción ha quedado completada. La URL del stream es: (${
          streamData?.url || ""
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
      message: `Hola ${name}, no se identificó ese partido; es posible que haya un error en el ID del stream :)`,
    };
  }
};
