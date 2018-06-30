import * as path from 'path';
import {DockerCompose, DockerMachine} from '../src/index';
import test from 'ava';


test.skip('create docker-machine', async t => {
  const MACHINE_NAME = 'node-docker-toolbox-ava-test';

  const machinePromise = DockerMachine.create(MACHINE_NAME, "digitalocean", {
    accessToken: 'fake-token-this-will-fail'
  });
  
  machinePromise.childProcess.stdout.on('data', (chunk) => {
    t.log(chunk.toString().trim());
  });

  machinePromise.childProcess.stderr.on('data', (chunk) => {
    t.log(chunk.toString().trim());
  });

  const machine = await machinePromise;

  t.truthy(machine.env);

  t.pass();
});

test('docker-compose build', async t => {
  const configPath = path.resolve(__dirname, 'docker-compose.yml');
  const compose = new DockerCompose({configPath});
  const buildPromise = compose.build();

  buildPromise.childProcess.stdout.on('data', (chunk) => {
    t.log(chunk.toString().trim());
  });

  buildPromise.childProcess.stderr.on('data', (chunk) => {
    t.log(chunk.toString().trim());
  });

  await buildPromise;

  t.pass();
});
