export interface EmailAccount {
  id: string;
  email: string;
  name?: string;
  provider: string;
  isDefault?: boolean;
}

class AccountSwitchingService {
  private selectedAccountId: string | null = null;
  private subscribers: Array<() => void> = [];

  setSelectedAccount(accountId: string | null) {
    this.selectedAccountId = accountId;
    this.notifySubscribers();
  }

  getSelectedAccountId() {
    return this.selectedAccountId;
  }

  subscribe(callback: () => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback());
  }
}

export const accountSwitchingService = new AccountSwitchingService();