import {spawn, ChildProcess, SpawnOptions} from 'child_process';

export interface DockerToolboxPromise<T> extends Promise<T> {
  childProcess: ChildProcess;
};

function makeDtPromise<T>(
  promise: Promise<T>,
  childProcess: ChildProcess
): DockerToolboxPromise<T> {
  (<DockerToolboxPromise<T>>promise).childProcess = childProcess;

  return (<DockerToolboxPromise<T>>promise);
}

function _spawnDockerToolbox
  ( program:       string
  , args:          ReadonlyArray<string>
  , spawnOptions:  SpawnOptions
  )
{

  spawnOptions = Object.assign({}, spawnOptions, {
    windowsHide: true
  });

  let childProcess = spawn(program, args, spawnOptions);
  let promise = new Promise<void>((resolve, reject) => {

    childProcess.on('error', (err: Error) => {
      reject(err);
    });

    childProcess.on('close', (code: number, signal: string) => {
      console.log("Closed with:", code, signal);
      if(code === 0) {
        resolve();
      } else {
        reject(new Error(program + ' responded with non-zero code ' + code));
      }
    });

  });

  return makeDtPromise(promise, childProcess);
}

function spawnDockerCompose
  ( args:          ReadonlyArray<string>
  , spawnOptions:  SpawnOptions
  )
{
  return _spawnDockerToolbox('docker-compose', args, spawnOptions);
}

function spawnDockerMachine
  ( args:          ReadonlyArray<string>
  , spawnOptions:  SpawnOptions
  )
{
  return _spawnDockerToolbox('docker-machine', args, spawnOptions);
}

export interface IDockerComposeOptions {
  
  /**
   * Path to your docker-compose.yml file(s)
   */
  configPath?: string|string[];

  /**
   * Docker machine to run on 
   */
  machine?: DockerMachine;
}

export interface IDockerComposeBuildOptions {
  /**
   * Compress the build context using gzip.
   */
  compress?: boolean;

  /**
   * Always remove intermediate containers.
   */
  forceRemove?: boolean;

  /**
   * Do not use cache when building the image.
   */
  noCache?: boolean;

  /**
   * Always attempt to pull a newer version of the image.
   */
  pull?: boolean;

  /**
   * Sets memory limit for the build container.
   */
  memory?: string;

  /**
   * Set build-time variables for services.
   */
  buildArgs?: {[key:string]: string|number|boolean};
}

export class DockerCompose {

  private _machine?: DockerMachine;
  private _configPaths: string[] = [];

  constructor(options?: IDockerComposeOptions) {

    if(options.machine) {
      this._machine = options.machine;
    }
    
    if(options.configPath) {
      if(typeof options.configPath === "string") {
        this._configPaths = [options.configPath];
      } else
      if(Array.isArray(options.configPath)) {
        this._configPaths = options.configPath;
      }
    }
  }

  _spawn(command: string, args: string[]): DockerToolboxPromise<void> {
    const configArgs = this._configPaths
      .map(confPath => ['-f', confPath])
      .reduce((confArgs, confArg) => confArgs.concat(confArg), []);
    const allArgs = configArgs.concat([command], args);
    let env: any = null;

    if(this._machine) {
      env = this._machine.env;
    }

    return spawnDockerCompose(allArgs, {env});
  }

  /**
   * Build or rebuild all services with default options
   *
   * @description Services are built once and then tagged as `project_service`,
   * e.g. `composetest_db`. If you change a service's `Dockerfile` or the
   * contents of its build directory, you can run `compose.build(...)` to 
   * rebuild it.
   * 
   * @example await compose.build();
   */
  build(): DockerToolboxPromise<void>;

  /**
   * Build or rebuild all services with default options
   *
   * @description Services are built once and then tagged as `project_service`,
   * e.g. `composetest_db`. If you change a service's `Dockerfile` or the
   * contents of its build directory, you can run `compose.build(...)` to 
   * rebuild it.
   * 
   * @example await compose.build('db', 'client');
   */
  build(...services: string[]): DockerToolboxPromise<void>;

  /**
   * Build or rebuild all services with default options
   *
   * @description Services are built once and then tagged as `project_service`,
   * e.g. `composetest_db`. If you change a service's `Dockerfile` or the
   * contents of its build directory, you can run `compose.build(...)` to 
   * rebuild it.
   * 
   * @example
   *  const options: IDockerComposeBuildOptions = {
   *    pull: true
   *  };
   *  await compose.build(options);
   */
  build(options: IDockerComposeBuildOptions): DockerToolboxPromise<void>;

  /**
   * Build or rebuild all services with default options
   *
   * @description Services are built once and then tagged as `project_service`,
   * e.g. `composetest_db`. If you change a service's `Dockerfile` or the
   * contents of its build directory, you can run `compose.build(...)` to 
   * rebuild it.
   * 
   * @example
   *  const options: IDockerComposeBuildOptions = {
   *    pull: true
   *  };
   *  await compose.build(options, 'db', 'client');
   */
  build(
    options: IDockerComposeBuildOptions,
    ...services: string[]
  ): DockerToolboxPromise<void>;

  build(...args: any[]): DockerToolboxPromise<void> {
    let options: IDockerComposeBuildOptions = {};
    let services: string[] = [];

    if(args.length > 0) {
      if(typeof args[0] === "string") {
        services = args;
      } else {
        options = args[0];
      }

      args.splice(0, 1);

      services = args;
    }

    const optArgs: string[] = [];

    for(const key in options) {
      const optionKey = key as keyof IDockerComposeBuildOptions;
      const value = options[optionKey];
      
      switch(optionKey) {
        case 'compress': value && optArgs.push('--compress'); break;
        case 'forceRemove': value && optArgs.push('--force-rm'); break;
        case 'noCache': value && optArgs.push('--no-cache'); break;
        case 'pull': value && optArgs.push('--pull');
        case 'memory':
          optArgs.push('--memory');
          optArgs.push(value as string);
          break;
        case 'buildArgs':
          for(const buildArg in value as object) {
            const buildArgValue = "" + value[buildArg];

            optArgs.push('--build-arg')
            optArgs.push(`${buildArg}="${buildArgValue}"`);
          }
          break;
      }
    }

    return this._spawn('build', [].concat(optArgs, services));
  }
}

export interface IDockerMachineOptions {
  debug?: boolean;
  storagePath?: string;
  tlsCaCert?: string;
  tlsCaKey?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  githubApiToken?: string;
  nativeSsh?: boolean;
  bugsnagApiToken?: string;
}

export interface IDockerMachineEnvOptions {
  /**
   * Display the Swarm config instead of the Docker daemon
   */
  swarm?: boolean;

  /**
   * Force environment to be configured for a specified shell: [fish, cmd, 
   * powershell, tcsh], default is auto-detect
   */
  shell?: string;

  /**
   * Add machine IP to NO_PROXY environment variable
   */
  noProxy?: boolean;
}

export interface IDockerMachineEnv {
  [key:string]: string;
}

export class DockerMachine {

  static env(
    name: string,
    options?: IDockerMachineEnvOptions
  ): DockerToolboxPromise<IDockerMachineEnv> {
    let result = spawnDockerMachine(['env', name], {});
    let machineEnv: IDockerMachineEnv = {};

    let out: string = '';

    result.childProcess.stdout.on('data', chunk => {
      out += chunk;
    });

    const machineEnvPromise = result.then(() => {
      const DOCKER_MACHINE_NAME = 'DOCKER_MACHINE_NAME';
      const lines = out.split(/\r\n|\n/);
      const test = lines.find(line => line.indexOf(DOCKER_MACHINE_NAME) > -1);

      const testStartIndex = test.indexOf(DOCKER_MACHINE_NAME);
      const testEndIndex = testStartIndex + DOCKER_MACHINE_NAME.length;
      const nameStartIndex = test.indexOf(name);
      const nameEndIndex = nameStartIndex + name.length;

      const regExpStr =
        test.substr(0, testStartIndex) + '([a-z_]+)' +
        test.substring(testEndIndex, nameStartIndex) + '(.*?)' +
        test.substr(nameEndIndex) + '$';
      
      const regExp = new RegExp(regExpStr, 'i');

      for(const line of lines) {
        const match = line.match(regExp);
        if(match && match.length > 2) {
          const envVar = match[1];
          const envValue = match[2];

          machineEnv[envVar] = envValue;
        }
      }

      return machineEnv;
    });

    return makeDtPromise(machineEnvPromise, result.childProcess);
  }

  static get(
    name: string,
    options?: IDockerMachineOptions,
    envOptions?: IDockerMachineEnvOptions,
  ): DockerToolboxPromise<DockerMachine> {

    let envPromise = DockerMachine.env(name, envOptions);
    let machinePromise = envPromise.then(env => {
      let machine = new DockerMachine(name, env, options);

      return machine;
    });

    return makeDtPromise(machinePromise, envPromise.childProcess);
  }
  
  private _name: string;
  private _env: IDockerMachineEnv;

  private constructor(
    name: string,
    env: IDockerMachineEnv,
    options?: IDockerMachineOptions
  ) {
    this._name = name;
    this._env = env;
  }

  /**
   * Parsed output from docker-machine env. Call refreshEnv() to update.
   */
  get env(): IDockerMachineEnv {
    return this._env;
  }

  /**
   * Re execute docker-machine env and update parsed data.
   */
  refreshEnv(
    options?: IDockerMachineEnvOptions
  ): DockerToolboxPromise<IDockerMachineEnv> {
    let envPromise = DockerMachine.env(this._name, options);
    let retEnvPromise = envPromise.then((env) => {
      this._env = env;
      return env;
    });

    return makeDtPromise(retEnvPromise, envPromise.childProcess);
  }
}
