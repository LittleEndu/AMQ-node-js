# AMQ-node-js
Local client for Anime Music Quiz that supports Discord rich presence

## Userscript support
Support for javascript scripting is really, really basic. 
Hit <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> and add the scripts to ``scripts`` folder. 
You need to manually download any requirements these scripts might have.

### Missing requirement error
When you get a warning about missing requirements it could be caused by basically these two things:

* The required script is not downloaded
  * Look at the erroring script in notepad or something, you need to download and add to your folder any script that's after // @require
* The required script has been renamed
  * Rename the script back to what is expected.

If you do find any script that doesn't work, and you can't fix it yourself 
then you can find me (LittleEndu#0001) on [AMQ discord](https://discord.gg/ZqTJeyV), you can DM me once you have joined
(that means don't send me a friend request, I won't accept it, join the discord server and DM me then).

## Style support
There is none. 
Your best solution is to wrap whatever css you want to use in a function like the example below, 
save it as a script and add it like you would some other userscript (instructions above). 
The ``AMQ_addStyle`` function is copied from [Joseph's amqScriptInfo.js](https://github.com/TheJoseph98/AMQ-Scripts/blob/0be15deb8fb5318bc6594c617e4889ff3ec72b71/common/amqScriptInfo.js#L90-L96).

```js
function AMQ_addStyle(css) {
  let head = document.head;
  let style = document.createElement("style");
  head.appendChild(style);
  style.type = "text/css";
  style.appendChild(document.createTextNode(css));
}

AMQ_addStyle(`

/* your css here */

`)
```

## Will I get into trouble if I use this client?
This client is nothing more than an embedded web browser that also communicates with your local Discord client.
AMQ vise, it doesn't give you any advantages. No new functionality nor new features are added, and will never be added.

If you are instead concerned about this client being a virus, know that [it isn't.](https://www.virustotal.com/gui/file/5521600246dec761efb8cf9d67fe9cff58d6718a4e21fec9b9628223e1226a9c/detection)

## Download
Grab the latest release [from here](https://github.com/LittleEndu/AMQ-node-js/releases)

## Build instructions
I just ran ``electron-builder`` so YMMV
