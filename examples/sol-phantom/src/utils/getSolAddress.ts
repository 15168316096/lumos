import { PhantomProvider } from '../types';
import {Simulate} from "react-dom/test-utils";
import error = Simulate.error;

/**
 * return sol address
 * @param   {PhantomProvider} provider a Phantom Provider
 * @returns {Any}                      TODO(get type)
 */
const getSolAddress = async (provider: PhantomProvider): Promise<string> => {
    try {
        const resp = await provider.connect();
        console.log("public key:", JSON.stringify(resp.publicKey.toString()));
        return resp.publicKey.toString();
    } catch (err) {
        console.warn(error);
        throw new Error(error.toString());
        // { code: 4001, message: 'User rejected the request.' }
    }
};

export default getSolAddress;
