import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: Promise<string>;
  recoveryCodes: string[];
}

interface VerifyTwoFactorCodeParams {
  secret: string;
  token: string;
}

export class TwoFactorAuth {
  static generateSecret(email: string): TwoFactorSetup {
    const secret = speakeasy.generateSecret({
      name: `ResumeCustomizer:${email}`,
      length: 20,
    });

    // Generate recovery codes (5 codes, 16 characters each)
    const recoveryCodes = Array(5)
      .fill(null)
      .map(() => this.generateRecoveryCode(16));

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url || '',
      qrCodeDataUrl: QRCode.toDataURL(secret.otpauth_url || ''),
      recoveryCodes,
    };
  }

  static verifyCode({ secret, token }: VerifyTwoFactorCodeParams): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step (30 seconds) before/after current time
    });
  }

  static verifyRecoveryCode(recoveryCode: string, recoveryCodes: string[]): {
    isValid: boolean;
    updatedRecoveryCodes: string[];
  } {
    const codeIndex = recoveryCodes.findIndex(code => 
      code === recoveryCode.trim().replace(/-/g, '').toUpperCase()
    );

    if (codeIndex === -1) {
      return { isValid: false, updatedRecoveryCodes: recoveryCodes };
    }

    // Remove the used recovery code
    const updatedCodes = [...recoveryCodes];
    updatedCodes.splice(codeIndex, 1);

    return { 
      isValid: true, 
      updatedRecoveryCodes: updatedCodes 
    };
  }

  private static generateRecoveryCode(length: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    
    // Generate random string
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Format as XXXX-XXXX-XXXX-XXXX
    return result.match(new RegExp(`.{1,${4}}`, 'g'))?.join('-') || result;
  }
}
