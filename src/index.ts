import {spawn, ChildProcess, SpawnOptions} from 'child_process';
import {optionsToArgs, IOptionsToArgsParseOptions} from './util';

export interface DockerToolboxPromise<T> extends Promise<T> {
  childProcess: ChildProcess;
};

function makeDtPromise<T>
  ( promise: Promise<T>
  , childProcess: ChildProcess
  ): DockerToolboxPromise<T>
{
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

    const optArgs: string[] = optionsToArgs(options);

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

/**
 * Amazon Web Services docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/aws/
 */
export interface IDockerMachineAmazonWebServiceDriverOptions {
  /**
   *  Your access key ID for the Amazon Web Services API.
   */
  accessKey?: string;

  /**
   * The AMI ID of the instance to use.
   */
  ami?: string;

  /**
   * AWS spot instance duration in minutes (60, 120, 180, 240, 300, or 360).
   */
  blockDurationMinutes?: number;

  /**
   * The root device name of the instance.
   */
  deviceName?: string;

  /**
   * Optional endpoint URL (hostname only or fully qualified URI)
   */
  endpoint?: string;

  /**
   * The AWS IAM role name to be used as the instance profile.
   */
  iamInstanceProfile?: string;

  /**
   * Disable SSL when sending requests
   */
  insecureTransport?: boolean;

  /**
   * The instance type to run.
   */
  instanceType?: string;

  /**
   * AWS keypair to use; requires ssh-keypath
   */
  keypairName?: string;

  /**
   * Enable CloudWatch Monitoring.
   */
  monitoring?: boolean;

  /**
   * Make the specified port number accessible from the Internet.
   */
  openPort?: number;

  /**
   * Use the private IP address only.
   */
  privateAddressOnly?: boolean;
  
  /**
   * The region to use when launching the instance.
   */
  region?: string;

  /**
   * Use spot instances.
   */
  requestSpotInstance?: boolean;

  /**
   * Set retry count for recoverable failures (use -1 to disable)
   */
  retries?: number;

  /**
   * The root disk size of the instance (in GB).
   */
  rootSize?: number;

  /**
   * Your secret access key for the Amazon Web Services API.
   */
  secretKey?: string;

  /**
   * AWS VPC security group name.
   */
  securityGroup?: string;

  /**
   * Your session token for the Amazon Web Services API.
   */
  sessionToken?: string;

  /**
   * Spot instance bid price (in dollars). Requires requestSpotInstance 
   * to be set.
   */
  spotPrice?: number;

  /**
   * Path to Private Key file to use for instance. Matching public key with 
   * .pub extension should exist
   */
  sshKeypath?: string;

  /**
   * The SSH Login username, which must match the default SSH user set in the 
   * ami used.
   */
  sshUser?: string;

  /**
   * AWS VPC subnet ID.
   */
  subnetId?: string;

  /**
   * AWS extra tag key-value pairs.
   * 
   * @example ['key1', 'value1', 'key2', 'value2']
   */
  tags?: string;

  /**
   * Create an EBS Optimized Instance, instance type must support it.
   */
  useEbsOptimizedInstance?: boolean;

  /**
   * Use the private IP address for docker-machine, but still create a public 
   * IP address.
   */
  usePrivateAddress?: boolean;

  /**
   * Path to file with cloud-init user data.
   */
  userdata?: string;

  /**
   * The Amazon EBS volume type to be attached to the instance.
   */
  volumeType?: string;

  /**
   *  Your VPC ID to launch the instance in.
   */
  vpcId?: string;

  /**
   * The AWS zone to launch the instance in (one of a,b,c,d,e).
   */
  zone?: string;
};

/**
 * Microsoft Azure docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/azure/
 */
export interface IDockerMachineAzureDriverOptions {
  /**
   * Your Azure Subscription ID.
   */
  azureSubscriptionId: string;

  /**
   * Azure Availability Set to place the virtual machine into.
   * @see https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-manage-availability/
   */
  availabilitySet?: string;

  /**
   * Port number for Docker engine.
   */
  dockerPort?: number;

  /**
   * Azure environment. For example, AzurePublicCloud or AzureChinaCloud.
   */
  environment?: string;

  /**
   * Azure virtual machine image in the format of Publisher:Offer:Sku:Version
   * @see https://azure.microsoft.com/en-us/documentation/articles/resource-groups-vm-searching/
   */
  image?: string;

  /**
   * Azure region to create the virtual machine.
   * @see https://azure.microsoft.com/en-us/regions/
   */
  location?: string;

  /**
   * Do not create a public IP address for the machine (implies usePrivateIp). 
   * Should be used only when creating machines from an Azure VM within the 
   * same subnet.
   */
  noPublicIp?: boolean;

  /**
   * Make additional port number(s) accessible from the Internet
   * @see https://azure.microsoft.com/en-us/documentation/articles/virtual-networks-nsg/
   */
  openPort?: number|string|Array<string|number>;

  /**
   * Specify a static private IP address for the machine.
   */
  privateIpAddress?: string;

  /**
   * Azure Resource Group name to create the resources in.
   */
  resourceGroup?: string;

  /**
   * Size for Azure Virtual Machine.
   * @see https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-size-specs/
   */
  size?: string;

  /**
   * Username for SSH login.
   */
  sshUser?: string;

  /**
   * Assign a static public IP address to the machine.
   */
  staticPublicIp?: boolean;

  /**
   * Azure Subnet Name to be used within the Virtual Network.
   */
  subnet?: string;

  /**
   * Private CIDR block. Used to create subnet if it does not exist. Must match 
   * in the case that the subnet does exist.
   */
  subnetPrefix?: string;

  /**
   * Use private IP address of the machine to connect. Useful for managing 
   * Docker machines from another machine on the same network, such as when 
   * deploying Swarm.
   */
  usePrivateIp?: boolean;

  /**
   * Azure Virtual Network name to connect the virtual machine. To specify a
   * Virtual Network from another resource group, use resourcegroup:vnet-name
   * format.
   * @see https://azure.microsoft.com/en-us/documentation/articles/virtual-networks-overview/
   */
  vnet?: string;
}

/**
 * Digital Ocean docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/digital-ocean/
 */
export interface IDockerMachineDigitalOceanDriverOptions {
  /**
   * Your personal access token for the Digital Ocean API.
   */
  accessToken: string;

  /**
   * Enable Digital Ocean backups for the droplet.
   */
  backups?: boolean;

  /**
   * The name of the Digital Ocean image to use.
   */
  image?: string;

  /**
   * Enable IPv6 support for the droplet.
   */
  ipv6?: boolean;

  /**
   * Enable monitoring for the droplet.
   */
  monitoring?: boolean;

  /**
   * Enable private networking support for the droplet.
   */
  privateNetworking?: boolean;

  /**
   * The region to create the droplet in, see Regions API for how to get a list.
   */
  region?: string;

  /**
   * The size of the Digital Ocean droplet (larger than default options are of the form 2gb).
   */
  size?: string;

  /**
   * Use an existing SSH key instead of creating a new one, see SSH keys.
   */
  sshKeyFingerprint?: string;

  /**
   * SSH private key path
   */
  sshKeyPath?: string;

  /**
   * SSH port.
   */
  sshPort?: number;

  /**
   * SSH username.
   */
  sshUser?: string;

  /**
   * Comma-separated list of tags to apply to the Droplet, see Droplet tagging
   */
  tags?: string[];

  /**
   * Path to file containing User Data for the droplet.
   */
  userdata?: string;
};

/**
 * Exoscale docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/exoscale/
 */
export interface IDockerMachineExoscaleDriverOptions {
  /**
   * Anti-affinity group the machine is started in.
   * @see https://community.exoscale.com/documentation/compute/anti-affinity-groups/
   */
  affinityGroup?: string;

  /**
   * Your API key;
   */
  apiKey: string;

  /**
   * required Your API secret key;
   */
  apiSecretKey: string;

  /**
   * Exoscale availability zone (ch-dk-2, at-vie-1, de-fra-1, ...);
   * @see https://www.exoscale.com/datacenters/
   */
  availabilityZone?: string;

  /**
   * Disk size for the host in GiB (at least 10);
   */
  diskSize?: number;

  /**
   * Image template, for example ubuntu-16.04, also known as Linux Ubuntu 16.04 
   * LTS 64-bit
   * @see https://docs.docker.com/machine/drivers/exoscale/#image-template-name
   */
  image?: string;

  /**
   * Instance profile (Small, Medium, Large, ...);
   */
  instanceProfile?: string;

  /**
   * Security group. It is created if it doesn't exist;
   */
  securityGroup?: string;

  /**
   * Path to the SSH user private key. A new one is created if left empty;
   */
  sshKey?: string;

  /**
   * SSH username to connect, such as ubuntu
   * @see https://docs.docker.com/machine/drivers/exoscale/#ssh-username
   */
  sshUser?: string;

  /**
   * Your API endpoint;
   */
  url?: string;

  /**
   * Path to file containing user data for cloud-init;
   * @see https://cloud-init.io/
   */
  userdata?: string;
};

/**
 * Generic docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/generic/
 */
export interface IDockerMachineGenericDriverOptions {
  /**
   * Port to use for Docker Daemon (Note: This flag does not work with 
   * boot2docker).
   */
  enginePort?: number;

  /**
   * IP Address of host.
   */
  ipAddress: string;

  /**
   * Path to the SSH user private key.
   */
  sshKey?: string;

  /**
   * SSH username used to connect.
   */
  sshUser?: string;
  
  /**
   * Port to use for SSH.
   */
  sshPort?: number;
};

/**
 * Google Compute Engine docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/gce/
 */
export interface IDockerMachineGoogleComputeEngineDriverOptions {
  /**
   * Instance's static external IP (name or IP).
   */
  address?: string;

  /**
   * The disk size of instance.
   */
  diskSize?: number;

  /**
   * The disk type of instance.
   */
  diskType?: string;

  /**
   * The absolute URL to a base VM image to instantiate.
   */
  machineImage?: string;

  /**
   * The type of instance.
   */
  machineType?: string;

  /**
   * Specify network in which to provision VM.
   */
  network?: string;

  /**
   * Instance preemptibility.
   */
  preemptible?: boolean;

  /**
   * The ID of your project to use when launching the instance.
   */
  project: string;

  /**
   * The scopes for OAuth 2.0 to Access Google APIs. See Google Compute Engine 
   * Doc.
   */
  scopes?: string[];

  /**
   * Specify subnetwork in which to provision VM.
   */
  subnetwork?: string;

  /**
   * Instance tags (comma-separated).
   */
  tags?: string[];

  /**
   * Don't create a new VM, use an existing one. This is useful when you'd like 
   * to provision Docker on a VM you created yourself, maybe because it uses 
   * create options not supported by this driver.
   */
  useExisting?: boolean;

  /**
   * When this option is used during create, the new VM is not assigned a 
   * public IP address. This is useful only when the host running 
   * docker-machine is located inside the Google Cloud infrastructure; 
   * otherwise, docker-machine can't reach the VM to provision the Docker 
   * daemon. The presence of this flag implies `useInternalIp`.
   */
  useInternalIpOnly?: boolean;

  /**
   * When this option is used during create, docker-machine uses internal 
   * rather than public NATed IPs. The flag is persistent in the sense that a 
   * machine created with it retains the IP. It's useful for managing docker 
   * machines from another machine on the same network, such as when deploying 
   * swarm.
   */
  useInternalIp?: boolean;

  /**
   * The username to use for the instance.
   */
  username?: string;

  /**
   * The zone to launch the instance.
   */
  zone?: string;
};

/**
 * Microsoft Hyper-V docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/hyper-v/
 */
export interface IDockerMachineMicrosoftHyperVDriverOptions {
  /**
   * The URL of the boot2docker ISO.
   */
  boot2dockerUrl?: string;

  /**
   * Name of the virtual switch to use.
   */
  virtualSwitch?: string;

  /**
   * Size of disk for the host in MB.
   */
  diskSize?: number;

  /**
   * Size of memory for the host in MB.
   */
  memory?: number;

  /**
   * Number of CPUs for the host.
   */
  cpuCount?: number;

  /**
   * Hyper-V network adapter's static MAC address.
   */
  staticMacaddress?: string;

  /**
   * Hyper-V network adapter's VLAN ID if any.
   */
  vlanId?: string;
};

/**
 * OpenStack docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/openstack/
 */
export interface IDockerMachineOpenStackDriverOptions {
  /**
   * Keystone service base URL.
   */
  authUrl: string;

  /**
   * Identify the flavor used for the machine. `flavorId` or `flavorName` must
   * be provided.
   */
  flavorId?: string;

  /**
   * Identify the flavor used for the machine.`flavorId` or `flavorName` must
   * be provided.
   */
  flavorName?: string;

  /**
   * Identify the image used for the machine. `imageId` or `imageName` must
   * be provided.
   */
  imageId?: string;

  /**
   * Identify the image used for the machine. `imageId` or `imageName` must
   * be provided.
   */
  imageName?: string;
 

  /**
   * The timeout in seconds until the OpenStack instance must be active.
   */
  activeTimeout?: number;

  /**
   * The availability zone in which to launch the server.
   */
  availabilityZone?: string;

  /**
   * Whether OpenStack should mount a configuration drive for the machine.
   */
  configDrive?: boolean;

  /**
   * Domain to use for authentication (Keystone v3 only).
   */
  domainName?: string;

  /**
   * Domain to use for authentication (Keystone v3 only).
   */
  domainId?: string;

  /**
   * Endpoint type can be internalURL, adminURL, or publicURL. It is a helper 
   * for the driver to choose the right URL in the OpenStack service catalog. 
   * If not provided the default is publicURL.
   */
  endpointType?: string;

  /**
   * The IP pool used to get a public IP can assign it to the machine. If there 
   * is an IP address already allocated but not assigned to any machine, this 
   * IP is chosen and assigned to the machine. If there is no IP address 
   * already allocated, a new IP is allocated and assigned to the machine.
   */
  floatingipPool?: string;

  /**
   * Specify the existing Nova keypair to use.
   */
  keypairName?: string;

  /**
   * Explicitly allow openstack driver to perform “insecure” SSL (https) 
   * requests. The server’s certificate is not verified against any certificate 
   * authorities. This option should be used with caution.
   */
  insecure?: boolean;

  /**
   * If the instance has both IPv4 and IPv6 address, you can select IP version. 
   * If not provided, defaults to 4.
   */
  ipVersion?: number;

  /**
   * Identify the private network the machine is connected to. If your 
   * OpenStack project contains only one private network it is used 
   * automatically.
   */
  netName?: string;

  /**
   * Identify the private network the machine is connected to. If your 
   * OpenStack project contains only one private network it is used 
   * automatically.
   */
  netId?: string;

  /**
   * User password. It can be omitted if the standard environment variable 
   * OS_PASSWORD is set.
   */
  password?: string;

  /**
   * Used with --openstack-keypair-name, associates the private key to the 
   * keypair.
   */
  privateKeyFile?: string;

  /**
   * The region to work on. Can be omitted if there is only one region on the 
   * OpenStack.
   */
  region?: string;

  /**
   * If security groups are available on your OpenStack you can specify a comma separated list to use for the machine, such as secgrp001,secgrp002.
   */
  secGroups?: string;

  /**
   * Customize the SSH port if the SSH server on the machine does not listen on 
   * the default port.
   */
  sshPort?: number;

  /**
   * The username to use for SSH into the machine. If not provided defaults to 
   * root.
   */
  sshUser?: string;

  /**
   * Identify the tenant in which the machine is created.
   */
  tenantName?: string;

  /**
   * Identify the tenant in which the machine is created.
   */
  tenantId?: string;

  /**
   * File containing an OpenStack userdata script.
   */
  userDataFile?: string;

  /**
   * User identifier to authenticate with.
   */
  username?: string;
};

/**
 * Rackspace docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/rackspace/
 */
export interface IDockerMachineRackspaceDriverOptions {
  /**
   * Rackspace active timeout
   */
  activeTimeout?: number;

  /**
   * Rackspace API key.
   */
  apiKey: string;

  /**
   * Set if Docker needs to be installed on the machine.
   */
  dockerInstall?: boolean;

  /**
   * Rackspace endpoint type (adminURL, internalURL or the default publicURL).
   */
  endpointType?: string;

  /**
   * Rackspace flavor ID. Default: General Purpose 1GB.
   */
  flavorId?: string;

  /**
   * Rackspace image ID. Default: Ubuntu 16.04 LTS (Xenial Xerus) (PVHVM).
   */
  imageId?: string;

  /**
   * Rackspace region name.
   */
  region: string;

  /**
   * SSH port for the newly booted machine.
   */
  sshPort?: number;

  /**
   * SSH user for the newly booted machine.
   */
  sshUser?: string;

  /**
   * Rackspace account username.
   */
  username: string;
};

/**
 * IBM Softlayer docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/soft-layer/
 */
export interface IDockerMachineIBMSoftlayerDriverOptions {
  /**
   * Change SoftLayer API endpoint.
   */
  apiEndpoint?: string;

  /**
   * API key for your user account.
   */
  apiKey: string;

  /**
   * Number of CPUs for the machine.
   */
  cpu?: number;

  /**
   * A value of 0 sets the SoftLayer default.
   */
  diskSize?: number;

  /**
   * Domain name for the machine.
   */
  domain: string;

  /**
   * Hostname for the machine.
   */
  hostname?: string;

  /**
   * Specifies that hourly billing should be used, otherwise monthly billing is 
   * used.
   */
  hourlyBilling?: boolean;

  /**
   * OS Image to use.
   */
  image?: string;

  /**
   * Use local machine disk instead of SoftLayer SAN.
   */
  localDisk?: boolean;

  /**
   * Memory for host in MB.
   */
  memory?: number;

  /**
   * Speed of network uplinks in Mbps (1000, 100, 10).
   */
  networkMaxSpeed?: number;

  /**
   * Disable public networking.
   */
  privateNetOnly?: boolean;

  /**
   * Your private VLAN ID.
   */
  privateVlanId?: string;

  /**
   * Your public VLAN ID.
   */
  publicVlanId?: string;

  /**
   * SoftLayer region.
   */
  region?: string;
  
  /**
   * Username for your SoftLayer account, API key needs to match this user.
   */
  user: string;
};

export interface IDockerMachineOracleVirtualBoxDriverOptions {
  /**
   *  The URL of the boot2docker image. Defaults to the latest available 
   * version.
   */
  boot2dockerUrl?: string;

  /**
   * Number of CPUs to use to create the VM. Defaults to single CPU.
   */
  cpuCount?: number;

  /**
   * Size of disk for the host in MB.
   */
  diskize?: number;

  /**
   * Use the host DNS resolver. (Boolean value, defaults to false)
   */
  hostDnsResolver?: boolean;

  /**
   * The CIDR of the host only adapter.
   */
  hostonlyCidr?: string;
  
  /**
   * Host Only Network Adapter Promiscuous Mode. Possible options are deny,
   * allow-vms, allow-all
   */
  hostonlyNicpromisc?: string;

  /**
   * Host Only Network Adapter Type. Possible values are ‘82540EM’ (Intel 
   * PRO/1000), ‘Am79C973’ (PCnet-FAST III), and ‘virtio’ Paravirtualized 
   * network adapter.
   */
  hostonlyNictype?: string;

  /**
   * Disable the Host Only DHCP Server
   */
  hostonlyNoDhcp?: boolean;

  /**
   * The name of a Boot2Docker VM to import.
   */
  importBoot2dockerVm?: string;

  /**
   * Size of memory for the host in MB.
   */
  memory?: number;

  /**
   * Specify the NAT Network Adapter Type. Possible values are are ‘82540EM’ 
   * (Intel PRO/1000), ‘Am79C973’ (PCnet-FAST III) and ‘virtio’ Paravirtualized 
   * network adapter.
   */
  natNictype?: string;

  /**
   *  Disable proxying all DNS requests to the host (Boolean value, default to 
   * false)
   */
  noDnsProxy?: boolean;

  /**
   *  Disable the mount of your home directory
   */
  noShare?: boolean;

  /**
   *  Disable checking for the availability of hardware virtualization before 
   * the vm is started
   */
  noVtxCheck?: boolean;

  /**
   * Mount the specified directory instead of the default home location. 
   * Format: dir:name
   */
  shareFolder?: string;

  /**
   * Specify the UI Type: (gui, sdl, headless, separate)
   */
  uiType?: string;
};

/**
 * VMware vCloud Air docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/vm-cloud/
 */
export interface IDockerMachineVMWareVCloudAirDriverOptions {
  /**
   * Catalog.
   */
  catalog?: string;

  /**
   * Catalog Item.
   */
  catalogitem?: string;

  /**
   * Compute ID (if using Dedicated Cloud).
   */
  computeid?: string;

  /**
   * VM CPU Count.
   */
  cpuCount?: number;

  /**
   * Docker port.
   */
  dockerPort?: number;

  /**
   * Organization Edge Gateway.
   */
  edgegateway?: string;

  /**
   * VM Memory Size in MB.
   */
  memorySize?: number;

  /**
   * Organization VDC Network to attach.
   */
  orgvdcnetwork?: string;

  /**
   * vCloud Air Password.
   */
  password: string;

  /**
   * Install Docker binaries.
   */
  provision?: boolean;

  /**
   * Org Public IP to use.
   */
  publicip?: string;

  /**
   * SSH port.
   */
  sshPort?: number;

  /**
   * vCloud Air Username.
   */
  username: string;

  /**
   * Virtual Data Center ID.
   */
  vdcid?: string;
};

/**
 * VMware Fusion docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/vm-fusion/
 */
export interface IDockerMachineVMWareFusionDriverOptions {
  /**
   * URL for boot2docker image.
   */
  boot2dockerUrl?: string;

  /**
   * Number of CPUs for the machine (-1 to use the number of CPUs available)
   */
  cpuCount?: number;

  /**
   * Size of disk for host VM (in MB).
   */
  diskSize: number;

  /**
   * Size of memory for host VM (in MB).
   */
  memorySize?: number;

  /**
   * Disable the mount of your home directory.
   */
  noShare?: boolean;
};

/**
 * VMware vSphere docker-machine driver options
 * @see https://docs.docker.com/machine/drivers/vsphere/
 */
export interface IDockerMachineVMWareVSphereDriverOptions {
  /**
   * URL for boot2docker image.
   */
  boot2dockerUrl?: string;

  /**
   * CPU number for Docker VM.
   */
  cpuCount?: number;

  /**
   *  Datacenter for Docker VM (must be set to ha-datacenter when connecting to 
   * a single host).
   */
  datacenter?: string;

  /**
   * Datastore for Docker VM.
   */
  datastore?: string;

  /**
   * Size of disk for Docker VM (in MB).
   */
  diskSize?: number;

  /**
   * vSphere folder for the docker VM. This folder must already exist in the 
   * datacenter.
   */
  folder?: string;

  /**
   * vSphere compute resource where the docker VM is instantiated. This can be 
   * omitted if using a cluster with DRS.
   */
  hostsystem?: string;

  /**
   * Size of memory for Docker VM (in MB).
   */
  memorySize?: number;
    
  /**
   * Network where the Docker VM is attached.
   */
  network?: string;

  /**
   * vSphere Password.
   */
  password: string;

  /**
   * Resource pool for Docker VM.
   */
  pool?: string;

  /**
   * vSphere Username.
   */
  username: string;

  /**
   * vSphere Port for vCenter.
   */
  vcenterPort?: number;

  /**
   * IP/hostname for vCenter (or ESXi if connecting directly to a single host).
   */
  vcenter?: string;

};

export type DockerMachineDriverOptions = 
  IDockerMachineAmazonWebServiceDriverOptions |
  IDockerMachineAzureDriverOptions |
  IDockerMachineDigitalOceanDriverOptions |
  IDockerMachineExoscaleDriverOptions |
  IDockerMachineGenericDriverOptions |
  IDockerMachineGoogleComputeEngineDriverOptions |
  IDockerMachineMicrosoftHyperVDriverOptions |
  IDockerMachineOpenStackDriverOptions |
  IDockerMachineRackspaceDriverOptions |
  IDockerMachineIBMSoftlayerDriverOptions |
  IDockerMachineOracleVirtualBoxDriverOptions |
  IDockerMachineVMWareVCloudAirDriverOptions |
  IDockerMachineVMWareFusionDriverOptions |
  IDockerMachineVMWareVSphereDriverOptions;

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

  /**
   * Create docker machine with the Amazon Web Services driver
   * @param name Machine name
   */
  static create(name: string, driver: 'amazonec2', options: IDockerMachineAmazonWebServiceDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the Microsoft Azure driver
   * @param name Machine name
   */
  static create(name: string, driver: 'azure', options: IDockerMachineAzureDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the Digital Ocean driver
   * @param name Machine name
   */
  static create(name: string, driver: 'digitalocean', options: IDockerMachineDigitalOceanDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the Exoscale driver
   * @param name Machine name
   */
  static create(name: string, driver: 'exoscale', options: IDockerMachineExoscaleDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the Generic driver
   * @param name Machine name
   */
  static create(name: string, driver: 'generic', options: IDockerMachineGenericDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the Google Compute Engine driver
   * @param name Machine name
   */
  static create(name: string, driver: 'google', options: IDockerMachineGoogleComputeEngineDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the Microsoft Hyper-V driver
   * @param name Machine name
   */
  static create(name: string, driver: 'hyperv', options: IDockerMachineMicrosoftHyperVDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the OpenStack driver
   * @param name Machine name
   */
  static create(name: string, driver: 'openstack', options: IDockerMachineOpenStackDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the Rackspace driver
   * @param name Machine name
   */
  static create(name: string, driver: 'rackspace', options: IDockerMachineRackspaceDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the IBM Softlayer driver
   * @param name Machine name
   */
  static create(name: string, driver: 'softlayer', options: IDockerMachineIBMSoftlayerDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the Oracle VirtualBox driver
   * @param name Machine name
   */
  static create(name: string, driver: 'virtualbox', options: IDockerMachineOracleVirtualBoxDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the VMware vCloud Air driver
   * @param name Machine name
   */
  static create(name: string, driver: 'vmwarevcloudair', options: IDockerMachineVMWareVCloudAirDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the VMware Fusion driver
   * @param name Machine name
   */
  static create(name: string, driver: 'vmwarefusion', options: IDockerMachineVMWareFusionDriverOptions): DockerToolboxPromise<DockerMachine>;

  /**
   * Create docker machine with the VMware vSphere driver
   * @param name Machine name
   */
  static create(name: string, driver: 'vmwarevsphere', options: IDockerMachineVMWareVSphereDriverOptions): DockerToolboxPromise<DockerMachine>;

  static create(name: string, driver: string, options: DockerMachineDriverOptions): DockerToolboxPromise<DockerMachine> {

    // Arguments that are specially parsed for a particular driver
    let specialOptArgs = [];

    if(driver === 'azure') {
      options = options as IDockerMachineAzureDriverOptions;

      if('openPort' in options) {
        const openPort = options.openPort;
        delete options.openPort;

        if(Array.isArray(openPort)) {
          for(const port of openPort) {
            specialOptArgs.push('--open-port');
            specialOptArgs.push(port);
          }
        } else {
          specialOptArgs.push('--open-port');
          specialOptArgs.push(openPort);
        }
      }
    }

    let optArgs = optionsToArgs(options, {
      prefix: driver + '-'
    });

    const createArgs = ['create', '--driver', driver].concat(
      optArgs,
      specialOptArgs,
      name
    );

    let createPromise = spawnDockerMachine(createArgs, {});

    return makeDtPromise(createPromise.then(() => {
      return DockerMachine.get(name);
    }), createPromise.childProcess);
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
