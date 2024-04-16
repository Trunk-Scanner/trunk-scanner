export class UnicationPagerApp {
    constructor(actualModel) {
        this.actualModel = actualModel;

        this.receiving = false;
        this.current_channel = "Central";
        this.current_zone = "Zone A";
        this.system = "Trunk-Scanner";

        this.socket = io();

        document.getElementById("pwr_button").addEventListener("click", () => {this.radioPowerOn();});
    }

    radioPowerOn()
    {
        console.log("Powering on...");
        setTimeout(() => {
            this.mainFunction();
        }, 1000);
    }

    mainFunction(time) {
        /*        let audio = new Audio('/public/audio/trunking_tg_priority.wav');
                audio.play();*/
        try {
            this.updateTextContent("1", this.current_zone);
            this.updateTextContent("2", this.current_channel);
            this.updateTextContent("3", this.system);

            this.socket.on("new_call", function (data) {
                console.log(data);
            });

            console.log("Unication pager app started");
        } catch (e) {
            console.log("Failed to start unication pager app");
            console.log(e);
        }
    }

    handleCallStart(call) {
        if(call.talkgroup === this.current_channel) {
            this.updateTextContent("1", `To:${call.talkgroup}`);
            this.updateTextContent("3", `Fm:[${call.source}]`);
            this.updateTextContent("2", '');
        }
    }

    handleCallStop(call){
        if(call.talkgroup === this.current_channel) {
            setTimeout(() =>{
                this.updateTextContent("1", this.current_zone);
                this.updateTextContent("2", this.current_channel);
                this.updateTextContent("3", this.system);
            }, 1500)
        }
    }

    editButtonClass(target, bool) {
        const classList = target.classList;
        classList.remove("enable-btn");
        classList.remove("disable-btn");

        if (bool)
            return classList.add("enable-btn");

        classList.add("disable-btn");
    }

    updateTextContent(line, newText) {
        const element = document.getElementById(`line${line}`);
        element.innerHTML = newText;
    }

    changeMenuName(menu_number, text){
        let thing = document.getElementById(`menu${menu_number}`);
        thing.innerHTML = text;
    }
}