import * as path from 'path';
import {DockerCompose, DockerMachine} from '../src/index';

DockerMachine.get('test-machine').then(machine => {
  const configPath = path.resolve(__dirname, 'docker-compose.yml');

  let compose = new DockerCompose({machine, configPath});
  let buildPromise = compose.build();
  buildPromise.childProcess.stdout.pipe(process.stdout);
  buildPromise.childProcess.stderr.pipe(process.stderr);

  buildPromise.then(() => {
    console.log("JOBS DONE!");
  });
});
