import fetch from "node-fetch";
import sodium from "libsodium-wrappers";

class GithubSecretUpdater {

    async getTokenFromApim() {
        const body = {
            "grant_type": "client_credentials",
            "client_id": process.env.APIM_CLIENT_ID,
            "client_secret": process.env.APIM_CLIENT_SECRET
        }

        const response = await fetch(`https://loccitaneeudev.gateway.webmethodscloud.de/invoke/pub.apigateway.oauth2/getAccessToken`, {
            method: 'POST',
            headers: {
                'Content-Type':'application/json'
            },
            body: JSON.stringify(body)
        })
        return response.json()
    }
    async getKeyId() {
        const response = await fetch('https://api.github.com/repos/Jordan-Afonso-OCC/status-page/actions/secrets/public-key', {
            method: 'GET',
            headers: {
                'Accept':'application/vnd.github+json',
                'Authorization':`Bearer ${process.env.GH_API_BEARER}`,
                'X-GitHub-Api-Version':'2022-11-28'
            }
        })
        return response.json()
    }

    async encryptSecret() {
        const publicKey = await this.getKeyId()
        this.publicKeyId = publicKey.key_id

        const secretValue = await this.getTokenFromApim()

        return sodium.ready.then(() => {
            const binkey = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL)
            const binsec = sodium.from_string(secretValue.access_token)

            const encBytes = sodium.crypto_box_seal(binsec, binkey);

            return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)
        });
    }
    async updateSecret() {
        const encryptedValue = await this.encryptSecret()
        const secretToUpdate = {encrypted_value:encryptedValue,key_id:this.publicKeyId}
        await fetch('https://api.github.com/repos/Jordan-Afonso-OCC/status-page/actions/secrets/SECRET_TOKEN', {
            method: 'PUT',
            headers: {
                'Accept':'application/vnd.github+json',
                'Authorization':`Bearer ${process.env.GH_API_BEARER}`,
                'X-GitHub-Api-Version':'2022-11-28'
            },
            body: JSON.stringify(secretToUpdate)
        })
    }

}

await new GithubSecretUpdater().updateSecret()