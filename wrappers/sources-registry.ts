import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  fromNano,
  Sender,
  SendMode,
  toNano,
} from "ton-core";

import * as sourcesRegistry from "../contracts/sources-registry";
import { toBigIntBE } from "bigint-buffer";

export class SourcesRegistry implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new SourcesRegistry(address);
  }

  static create(verifierRegistryAddress: Address, admin: Address, code: Cell, workchain = 0) {
    const data = sourcesRegistry.data({
      minTons: toNano("0.065"),
      maxTons: toNano(1),
      admin: admin,
      verifierRegistryAddress: verifierRegistryAddress,
    });
    const init = { code, data };
    return new SourcesRegistry(contractAddress(workchain, init), init);
  }

  async sendInternalMessage(provider: ContractProvider, via: Sender, body: Cell, value: bigint) {
    await provider.internal(via, {
      value: value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: body,
    });
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint, bounce = true) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
      bounce,
    });
  }

  async getChildAddressFromChain(
    provider: ContractProvider,
    verifier: string,
    codeCellHash: string
  ): Promise<Address> {
    const result = await provider.get("get_source_item_address", [
      {
        type: "int",
        value: toBigIntBE(sourcesRegistry.toSha256Buffer(verifier)),
      },
      {
        type: "int",
        value: toBigIntBE(Buffer.from(codeCellHash, "base64")),
      },
    ]);
    const item = result.stack.readCell();
    return item.beginParse().loadAddress()!;
  }

  async getVerifierRegistryAddress(provider: ContractProvider): Promise<Address> {
    const res = await provider.get("get_verifier_registry_address", []);
    const item = res.stack.readCell();
    return item.beginParse().loadAddress();
  }

  async getAdminAddress(provider: ContractProvider) {
    const res = await provider.get("get_admin_address", []);
    const item = res.stack.readCell();
    return item.beginParse().loadMaybeAddress();
  }

  async getCodeOpt(provider: ContractProvider) {
    const state = await provider.getState();
    if (state.state.type != "active") return null;
    return state.state.code;
  }

  async getDeploymentCosts(provider: ContractProvider) {
    const res = await provider.get("get_deployment_costs", []);
    const min = res.stack.readBigNumber();
    const max = res.stack.readBigNumber();
    return { min: fromNano(min), max: fromNano(max) };
  }
}
