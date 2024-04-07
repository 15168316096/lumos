import { PhantomProvider } from '../types';

/**
 * Signs a message
 * @param   {PhantomProvider} provider a Phantom Provider
 * @param   {String}          message  a message to sign
 * @returns {Any}                      TODO(get type)
 */
const signMessage = async (provider: PhantomProvider, message: string): Promise<string> => {
  try {
    let ckb_prefix = "CKB transaction: "
    console.log("digest:", JSON.stringify(message))
    const encodedMessage = new TextEncoder().encode(ckb_prefix + message);
    const signedMessage = await provider.signMessage(encodedMessage, "utf8");
    return signedMessage;
  } catch (error) {
    console.warn(error);
    throw new Error(error.message);
  }
};

export default signMessage;
