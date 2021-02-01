# AMQ-node-js
Local client for Anime Music Quiz that supports Discord rich presence

## Userscript support
Support for javascript scripting is really, really basic. 
Hit <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> and add the scripts to ``scripts`` folder. 
You need to manually manage any requirements these scripts might have. 
Scripts are loaded in alphabetical order, so you can just add numbers in front of them if you need to force loading order. 
Just watch out, ``2. foo.user.js`` will be loaded after ``10. bar.user.js``. 
Windows Explorer will actually show these files in "correct" order and not in alphabetical one. 
You want to use ``002. foo.user.js`` and ``010. bar.user.js`` when numbering scripts instead.

### Missing requirement error
When you get an warning about potentially missing requirements it could be caused by many things:

* The erroring script loads before the script it requires
  * Just order your scripts by adding ``!`` in-front of the required scripts
* The required script has been renamed
  * Rename the script back to what is expected. You can add characters to the name (for ordering purposes) but you can't have anything from the name
* The required script is not downloaded
  * Look at the erroring script in notepad or something, you need to download and add to your folder any script that's after // @require

If you do find any script that doesn't work, and you can't fix it yourself 
then you can find me (LittleEndu#0001) on [AMQ discord](https://discord.gg/ZqTJeyV), you can DM me once you have joined.

## Style support
There is none. 
Your best solution is to wrap whatever css you want to use in a function like the example below, 
save it as a script and add it like you would some other userscript (instructions above). 
Note that the ``addStyle`` function is copied from [Joseph's amqWindows.js](https://github.com/TheJoseph98/AMQ-Scripts/blob/1b363cc004b19ddc6a6b2d6df4c43c34f75d01b7/common/amqWindows.js#L369-L376) 
and if some userscript you have requires that script, then you only need to copy from the ``addStyle`` part for your css to work.

```js
function addStyle(css) {
    let head = document.head;
    let style = document.createElement("style");
    head.appendChild(style);
    style.type = "text/css";
    style.id = "customWindowStyle";
    style.appendChild(document.createTextNode(css));
}

addStyle(`

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
