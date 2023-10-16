import { Contract } from '@algorandfoundation/tealscript';

class Inner extends Contract {
  createApplication(): void {
    log('inner created');
  }
}

// eslint-disable-next-line no-unused-vars
class EventDemo extends Contract {
  outer(): void {
    log('outer called');

    sendMethodCall<[], void>({
      name: 'createApplication',
      approvalProgram: Inner,
      clearStateProgram: this.app.clearStateProgram,
    });
  }
}
