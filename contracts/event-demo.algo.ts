// eslint-disable-next-line import/no-relative-packages
import { Contract } from '../../../algorand-devrel/tealscript/src/lib/index';

class Inner extends Contract {
  innerEvent = new EventLogger<[string]>();

  createApplication(): void {
    log('this is a regular inner log');
    this.innerEvent.log('this is an inner event log');
  }
}

// eslint-disable-next-line no-unused-vars
class EventDemo extends Contract {
  outterEvent = new EventLogger<[string]>();

  outer(): void {
    log('this is a regular outer log');
    this.outterEvent.log('this is an outer event log');

    sendMethodCall<[], void>({
      name: 'createApplication',
      approvalProgram: Inner,
      clearStateProgram: this.app.clearStateProgram,
    });
  }
}
