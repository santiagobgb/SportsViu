/**
 * Retarda la ejecución del programa por la cantidad especificada de milisegundos.
 *
 * @param {number} ms - La cantidad de milisegundos que se deben retrasar la ejecución.
 * @return {Promise<void>} Una promesa que se resolverá después de que haya transcurrido el tiempo especificado.
 *
 * @example
 * // Retardar la ejecución por 1000 milisegundos (1 segundo)
 * await delay(1000);
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
