import { StdSignDoc } from '@cosmjs/amino';
import {
  DirectSignDoc,
  ExpiredError,
  RejectedError,
  SignOptions,
  State,
} from '@cosmos-kit/core';
import { WCClient } from '@cosmos-kit/walletconnect';
import { EngineTypes } from '@walletconnect/types';

type Aria = {
  connect: (uri: string) => void;
  // signTransaction: (
  //   requestEvent: Omit<
  //     SignClientTypes.EventArguments['session_request'],
  //     'verifyContext'
  //   >,
  // ) => Promise<void>;
  openExtension: () => void;
  signTransaction: () => void;
};

const getAria = async () => {
  // return { openExtension: () => undefined, connect: () => undefined };
  function domIsReady() {
    // already loaded
    if (['interactive', 'complete'].includes(document.readyState)) {
      return Promise.resolve();
    }

    // wait for load
    return new Promise(resolve => {
      window.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
  await domIsReady();
  const aria1: Aria = (window as any).aria;
  console.log('🚀 ~ file: client.ts:10 ~ aria:', aria1);

  return aria1;
};
// setTimeout(() => {
//   const aria: Aria = (window as any).aria;
//   console.log('🚀 ~ file: client.ts:10 ~ aria:', aria);
// }, 10000);

export class AriaClient extends WCClient {
  // eslint-disable-next-line no-underscore-dangle

  // eslint-disable-next-line class-methods-use-this
  // async openApp(withWCUri?: boolean) {
  //   const aria = await getAria();
  //   console.log('🚀 ~ file: client.ts:56 ~ aria:', aria);
  //   aria.openExtension();

  //   // super.openApp(withWCUri);
  // }

  async getAccount(chainId: string) {
    const aria = await getAria();
    aria.openExtension();
    return super.getAccount(chainId);
  }

  async signDirect(
    chainId: string,
    signer: string,
    signDoc: DirectSignDoc,
    signOptions?: SignOptions,
  ) {
    const aria = await getAria();
    aria.signTransaction();
    return super.signDirect(chainId, signer, signDoc, signOptions);
  }

  async signAmino(
    chainId: string,
    signer: string,
    signDoc: StdSignDoc,
    signOptions?: SignOptions,
  ) {
    const aria = await getAria();
    aria.signTransaction();
    return super.signAmino(chainId, signer, signDoc, signOptions);
  }

  // async signAmino(
  //   chainId: string,
  //   signer: string,
  //   signDoc: DirectSignDoc,
  //   signOptions?: SignOptions,
  // ) {
  //   const aria = await getAria();
  //   aria.openExtension();
  //   return super.signAmino(chainId, signer, signDoc, signOptions);
  // }

  async connect(
    chainIds: string | string[],
    options?: EngineTypes.ConnectParams,
  ) {
    if (typeof this.signClient === 'undefined') {
      await this.init();
      // throw new Error('WalletConnect is not initialized');
    }

    const chainIdsWithNS =
      typeof chainIds === 'string'
        ? [`cosmos:${chainIds}`]
        : chainIds.map(chainId => `cosmos:${chainId}`);

    this.restorePairings();

    const { pairing } = this;

    const requiredNamespaces = {
      cosmos: {
        methods: [
          'cosmos_getAccounts',
          'cosmos_signAmino',
          'cosmos_signDirect',
          ...(this.requiredNamespaces?.methods ?? []),
        ],
        chains: chainIdsWithNS,
        events: [
          'chainChanged',
          'accountsChanged',
          ...(this.requiredNamespaces?.events ?? []),
        ],
      },
    };

    let connectResp: any;

    try {
      this.logger?.debug('Connecting chains:', chainIdsWithNS);
      connectResp = await this.signClient.connect({
        pairingTopic: pairing?.topic,
        requiredNamespaces,
        ...options,
      });

      // https://github.com/hyperweb-io/projects-issues/issues/349
      // Commented out because of the issue above.
      // if (typeof connectResp.uri === 'undefined') {
      //   throw new Error('Failed to generate WalletConnect URI!');
      // }

      // this.qrUrl.data = connectResp.uri;
      console.log('Using QR URI:', connectResp.uri);
      // this.setQRState(State.Init);
      // if (this.displayQRCode) this.setQRState(State.Done);
    } catch (error) {
      console.log('Client connect error: ', error);
      if (this.displayQRCode) this.setQRError(error);
      return;
    }

    const aria = await getAria();
    console.log('🚀 ~ file: client.ts:100 ~ aria:', aria);

    aria.connect(connectResp.uri);

    this.setQRState(State.Init);

    // if (this.redirect) this.openApp();

    try {
      const session = await connectResp.approval();
      this.logger?.debug('Established session:', session);
      this.sessions.push(session);
      this.restorePairings();
    } catch (error) {
      this.logger?.error('Session approval error: ', error);
      await this.deleteInactivePairings();
      if (!error) {
        if (this.displayQRCode) this.setQRError(ExpiredError);
        throw new Error('Proposal Expired');
      } else if (error.code == 5001) {
        throw RejectedError;
      } else {
        throw error;
      }
    } finally {
      if (!pairing && this.qrUrl.message !== ExpiredError.message) {
        this.setQRState(State.Init);
      }
    }
  }
}
