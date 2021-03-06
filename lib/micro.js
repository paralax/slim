const os = require('os');
const vbox = require('node-virtualbox');
const VBoxProvider  =      require('node-virtualbox/lib/VBoxProvider');

const path = require('path');
const slimdir = path.join( os.homedir(), '.slim');
const privateKey = path.join(slimdir, 'baker_rsa');

class Micro {
    constructor() 
    {
        this.defaultOptions = 
        {
            mem: 1024,
            disk: false,
            verbose: true, 
            ssh_port: undefined // auto-find a ssh available port
        }

        this.driver = new VBoxProvider();
        this.privateKey = privateKey
    }

    async list() {
        try {
            let VMs = await this.driver.list();
            let table = [];
            // VMs = VMs.filter(VM => VM.cwd.includes('.baker/'));
            for( let vm of VMs)
            {
                let state = await this.getState(vm.name);
                let ports = await this._getUsedPorts(vm.name);
                table.push( {name: vm.name, state: state, ports: ports.join(',') } );
            }

            console.table('\nVms: ', table);
        } catch (err) {
            throw err
        }
        return;
    }

    /**
     * Returns State of a VM
     * @param {String} VMName
     */
    async getState(VMName) {
        let vmInfo = await this.driver.info(VMName);
        return vmInfo.VMState.replace(/"/g,'');
    }

    async _getUsedPorts(name)
    {
        let ports = [];
        let properties = await this.driver.info(name);
        for( let prop in properties )
        {
            if( prop.indexOf('Forwarding(') >= 0 )
            {
                try {
                    ports.push( parseInt( properties[prop].split(',')[3]) );
                }
                catch(e) { console.error(e); }
            }
        }
        return ports;
    }

    /**
     * Get ssh configurations
     * @param {Obj} machine
     * @param {Obj} nodeName Optionally give name of machine when multiple machines declared.
     */
    async getSSHConfig(machine, nodeName) {

        // Use VirtualBox driver
        let vmInfo = await this.driver.info(machine);
        let port = null;
        Object.keys(vmInfo).forEach(key => {
            if(vmInfo[key].includes('guestssh')){
                port = parseInt( vmInfo[key].split(',')[3]);
            }
        });
        return {user: 'root', port: port, host: machine, hostname: '127.0.0.1', private_key: this.privateKey};
    }

    async create(name, registery, options)
    {
        let root = (os.platform() == "win32") ? `${process.cwd().split(path.sep)[0]}/` : "/";

        let iso = path.join(registery, options.attach_iso, 'slim.iso');

        // Required options
        options.vmname = name;
        options.micro  = true;
        options.syncs  = [`${root};/data`];
        options.attach_iso = iso;

        // Overrideable options
        options.mem = options.mem || this.defaultOptions.mem;
        options.disk = options.disk || this.defaultOptions.disk;
        options.verbose = options.verbose || this.defaultOptions.verbose;
        options.ssh_port = options.ssh_port || this.defaultOptions.ssh_port;

        if ((await this.driver.list()).filter(e => e.name === name).length == 0) {
            await vbox(options);
        } else if((await this.getState(name)) != 'running') {
            await vbox({start: true, vmname: name, syncs: [], verbose: true});
        }

        let sshInfo = await this.getSSHConfig(name);
        console.log(`ssh -i ${sshInfo.private_key} ${sshInfo.user}@${sshInfo.hostname} -p ${sshInfo.port} -o StrictHostKeyChecking=no`)
    }

}




module.exports = Micro;