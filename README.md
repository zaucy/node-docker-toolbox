# node-docker-toolbox

Node.js wrapper for docker-compose and docker-machine

## Example

Build on a docker machine with docker compose

```TypeScript
import {DockerMachine, DockerCompose} from 'docker-toolbox';

const machine = await DockerMachine.get('machine-name');
const compose = new DockerCompose({machine});

await compose.build();

// If you want to see the output the ChildProcess is exposed as a property on
// the promise.

const buildPromise = compose.build();

buildPromise.childProcess.stdout.pipe(process.stdout);
buildPromise.childProcess.stderr.pipe(process.stderr);

await buildPromise;
console.log("jobs done!");
```
