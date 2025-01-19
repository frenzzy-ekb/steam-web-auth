class SteamGuardCrypto {
    static async deriveKey(password) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        
        const key = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('steam-guard'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            key,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    static async encrypt(data, key) {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(JSON.stringify(data))
        );
        
        return {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
        };
    }

    static async decrypt(encrypted, key) {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
            key,
            new Uint8Array(encrypted.data)
        );
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    }

    static async generateSteamGuardCode(shared_secret) {
        const time = Math.floor(Date.now() / 1000);
        const timeHex = Math.floor(time / 30).toString(16).padStart(16, '0');
        
        const hmacKey = this.base64ToBuffer(shared_secret);
        const timeBuffer = new Uint8Array(8);
        
        for (let i = 0; i < 8; i++) {
            timeBuffer[i] = parseInt(timeHex.substr(i * 2, 2), 16);
        }

        const key = await crypto.subtle.importKey(
            'raw',
            hmacKey,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            timeBuffer
        );

        const hmac = new Uint8Array(signature);
        const start = hmac[19] & 0xf;
        
        let codeInt = (
            ((hmac[start] & 0x7f) << 24) |
            ((hmac[start + 1] & 0xff) << 16) |
            ((hmac[start + 2] & 0xff) << 8) |
            (hmac[start + 3] & 0xff)
        );

        const steamChars = '23456BCDFGHJKMNPQRSTUVWXYZ';
        let code = '';
        
        for (let i = 0; i < 5; i++) {
            code += steamChars[codeInt % steamChars.length];
            codeInt = Math.floor(codeInt / steamChars.length);
        }
        
        return code;
    }

    static base64ToBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
} 