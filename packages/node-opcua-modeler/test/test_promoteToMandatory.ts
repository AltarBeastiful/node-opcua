import * as should from "should";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import {
    AddressSpace,
    assert,
    DataType,
    displayNodeElement,
    Namespace,
    NodeClass,
    nodesets,
    promoteChild,
    promoteToMandatory
} from "..";

import { removeDecoration } from "./test_helpers";

const namespaceUri = "urn:some";

function createModel(addressSpace: AddressSpace) {
    /* empty */
}

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("promoteToMandatory", () => {
    let addressSpace: AddressSpace;
    let nsDI: number;
    let ns: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        ns = addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [nodesets.standard, nodesets.di];

        await generateAddressSpace(addressSpace, nodesetsXML);
        createModel(addressSpace);

        nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        if (nsDI < 0) {
            throw new Error("Cannot find DI namespace!");
        }
    });
    after(() => {
        addressSpace.dispose();
    });

    it("when creating a sub type it should be possible to promote a component or property to mandatory", async () => {
        const deviceType = addressSpace.findObjectType("DeviceType", nsDI);
        if (!deviceType) {
            throw new Error("Cannot find DeviceType");
        }

        const boilerType = ns.addObjectType({
            browseName: "BoilerType",
            subtypeOf: deviceType
        });

        const deviceClass = promoteToMandatory(boilerType, "DeviceClass", nsDI);
        deviceClass.browseName.toString().should.eql(`${nsDI}:DeviceClass`);
        deviceClass.nodeClass.should.eql(NodeClass.Variable);
        deviceClass.modellingRule!.should.eql("Mandatory");

        const deviceHealth = promoteToMandatory(boilerType, "DeviceHealth", nsDI);
        deviceHealth.browseName.toString().should.eql(`${nsDI}:DeviceHealth`);
        deviceHealth.nodeClass.should.eql(NodeClass.Variable);
        deviceHealth.modellingRule!.should.eql("Mandatory");

        const str1 = displayNodeElement(boilerType);
        const a = removeDecoration(str1).split("\n");
        // console.log(a);

        // a[2 * 2 + 1].should.eql(`│ HasComponent Ⓥ         │ ns=1;i=1001  │ 2:DeviceHealth         │ Mandatory           │ BaseDataVariableType  │ 2:DeviceHealthEnumeration(Variant) │ null  │`);
        // a[13 * 2 + 1].should.eql(`│ HasComponent Ⓥ         │ ns=2;i=6208  │ 2:DeviceHealth         │ Optional            │ BaseDataVariableType  │ 2:DeviceHealthEnumeration(Variant) │ null  │`);
    });

    it("when creating a sub type it should be possible to promote a component or property to mandatory, and child node shall not be duplicated", async () => {
        const deviceType = addressSpace.findObjectType("DeviceType", nsDI);
        if (!deviceType) {
            throw new Error("Cannot find DeviceType");
        }

        const boilerType = ns.addObjectType({
            browseName: "BoilerType1",
            subtypeOf: deviceType
        });

        const parameterSet = promoteToMandatory(boilerType, "ParameterSet", nsDI);

        ns.addVariable({
            browseName: "Parameter1",
            dataType: DataType.Int32,
            componentOf: parameterSet,
            modellingRule: "Mandatory"
        });
        const param1 = parameterSet.getChildByName("Parameter1", ns.index);
        should.exist(param1);
        {
            const specialBoilerType = ns.addObjectType({
                browseName: "BoilerType2",
                subtypeOf: boilerType
            });
            const parameterSet2 = promoteChild(specialBoilerType, "ParameterSet", nsDI);

            const param2 = parameterSet2.getChildByName("Parameter1", ns.index)!;
            should.exist(param2);
            param2.modellingRule!.should.eql("Mandatory");

            const specialBoiler = specialBoilerType.instantiate({
                browseName: "SpecialBoiler",
                organizedBy: addressSpace.rootFolder.objects
            });
            const parameterSet3 = specialBoiler.getChildByName("ParameterSet", ns.index)!;
            should.exist(parameterSet3);

            const param3 = parameterSet3.getChildByName("Parameter1", ns.index)!;
            should.exist(param3);
            should.not.exist(param3.modellingRule," instance property should not have a modelling rule");

        }
    });
});
