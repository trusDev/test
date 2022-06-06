const fs = require("fs");
const mqtt = require("mqtt");

// not used right now
const BROKER_ADDRESS = process.env.BROKER_HOST
const BROKER_PORT = process.env.BROKER_PORT
const TAG_SEQUENCE = process.env.TAG_SEQUENCE
const TOPIC = process.env.TOPIC // I think this isn't used 
const DATA_SOURCE = process.env.TAG_SOURCE
const TIME_TO_RUN = process.env.TIME // NEW

const CONFIG_PATH = "./config_data.json";
const TAG_TEMPLATE_PATH = "./tag_data_template.json"

const BLINK_INTERVAL = 2200;
const MAX_TIME_OFFSET = 1500;

// TEMPORARY CONSTs, CHANGE LATER
const NUMBER_OF_TAGS = 10;
const TEMP_TIME_TO_RUN = 10000;
const host = "172.28.0.106";
const port = 8883;
const clientId = "noisy-cross-assortment";
const connectUrl = `mqtts://${host}:${port}`;
const username = "sniff";
const password = "sec";
const tag_topic = "dt/asm/farmid/tags/123";

// temporary
const base = "../../../../MQTT-Tools/mega-quantity-test-tool/auth/krakow2stage/noisy-cross-assortment/";
const CA_CERTS = fs.readFileSync(base + "device_rootca.pem");
const CERTFILE = fs.readFileSync(base + "devicecert.pem");
const KEYFILE = fs.readFileSync(base + "deviceprivate.key");

// CONFIGURE MQTT CLIENT
const client = mqtt.connect(connectUrl, {
    clientId,
    clear: true,
    connectTimeout:2000,
    username,
    password,
    recconectPeriod: 1000,
    ca: [CA_CERTS],
    cert: CERTFILE,
    key: KEYFILE
});

// --------------------------------------------------------------------------
// FUNCTIONS
// --------------------------------------------------------------------------
async function main() {
    
    const tags = loadTags();
    const offset_tags = addTimeOffset(tags);
    
    sendTags(offset_tags);
}
    
// return an array of NUMBER_OF_TAGS tags with unique IDs, randomised blinkIndexes and coords (based on a template file)
function loadTags() {
    let ret_tags = []
    let template = fs.readFileSync(TAG_TEMPLATE_PATH, "utf-8");
    template = JSON.parse(template);
    let new_tag;
    let id_count = 1000;
    
    while(ret_tags.length < NUMBER_OF_TAGS) {
        // deep copy of object
        new_tag = JSON.parse(JSON.stringify(template));
        // set unique id
        new_tag.tagId = id_count;
        id_count++;
        // set randomised blinkIndex
        new_tag.data.tagData.blinkIndex = Math.floor((Math.random() * 7000000) + 1000000)
        // set randomised coords
        new_tag.data.coordinates.x = Math.floor(Math.random() * 1000);
        new_tag.data.coordinates.y = Math.floor(Math.random() * 1000);
        new_tag.data.coordinates.z = Math.floor(Math.random() * 1000);
        ret_tags.push(new_tag);
    }
    return ret_tags;
    
}
// returns array [[single_tag_data1, time_offset1], [single_tag_data2, time_offset2], ...]
// this is done to add individual randomised time offset for sending tags
function addTimeOffset(tag_data) {
    let ret_tags = tag_data.map(tag => [tag, Math.floor(Math.random() * MAX_TIME_OFFSET)]);
    return ret_tags;
}

function sendTags(tag_data) {
    
    const end_time = Date.now() + TEMP_TIME_TO_RUN;
    
    const self = setInterval(async () => {
        let promises = tag_data.map(tag => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    
                    tag[0].timestamp = Date.now();
                    console.log(`Sent tagID: ${tag[0].tagId}, blinkIndex: ${tag[0].data.tagData.blinkIndex}, coords: (${tag[0].data.coordinates.x}, ${tag[0].data.coordinates.y}, ${tag[0].data.coordinates.z}) after ${tag[1]}ms`);
                    sendMQTT(tag[0]);
                    
                    tag[0].data.tagData.blinkIndex++;
                    tag[0].data.coordinates.x += Math.floor(Math.random() * 3 - 1);
                    tag[0].data.coordinates.y += Math.floor(Math.random() * 3 - 1);
                    tag[0].data.coordinates.z += Math.floor(Math.random() * 3 - 1);
                    resolve();
                }, tag[1])
            })
        });
        
        await Promise.all(promises);
        console.log("done");

        if(end_time < Date.now()) {
            clearInterval(self);
        }
    }, BLINK_INTERVAL);
}

function sendMQTT(tag) {
    client.publish(tag_topic, JSON.stringify([tag]), {qos: 0}, error => {
        if(error) {
            console.log(error);
        }
    });
}


client.on("connect", () => {
        main();
});
