# Midi-Dudes

Midi in, RGB light strip out! Just plug in both a keyboard in via a standard (DIN-5) Midi cable, and an addressable RGB LED strip (SK9822/Dotstar or WS281(X)/Neopixel-based strip) and run the [midiDudes](./midiDudes.ts) script.

https://user-images.githubusercontent.com/6108440/140427911-7cb8871e-7e6d-4ef0-b22c-ec55dec32007.mov

# Guide

![image](https://user-images.githubusercontent.com/6108440/140418469-cc1380da-4db1-4c1d-ac00-28d27b0fece9.png)

## Hardware

I used a Raspberry Pi Zero W for this, but any Pi running Linux should work. The "hat" I made serves 3 simple purposes:

1. Provide 5V to both LED strip and Pi from a single input jack
1. Shift 3V signal from Pi to 5V for LED strip
1. Convert MIDI signal for use as serial in to Raspberry PI GPIO

Technically for number 3, you could use a pre-built hat like [this](https://www.adafruit.com/product/4740) or even an off-the-shelf MIDI-to-USB device, though some modification of the config and code might be required as this guide and code are written specifically to use uart0 on GPIO pin #6.

### 1. Get parts

Here are all the parts I used:

- General
  - Fairly small proto-board ([Adafruit](https://www.adafruit.com/product/4785))
  - Barrel jack for power in ([Adafruit](https://www.adafruit.com/product/373))
  - Around 4A 5V switching supply ([Adafruit](https://www.adafruit.com/product/1466))
  - Raspberry Pi (This program only uses one core so there's no benefit to having more) ([Adafruit](https://www.adafruit.com/product/3708))
  - SD card if your Pi doesn't come with one ([Adafruit](https://www.adafruit.com/product/2693) | [Amazon](https://www.amazon.com/gp/product/B07B98GXQT) ⬅ this is my absolute favorite cheap/fast SD card for Pis)
  - Socket headers to attach the PI to the proto board ([Adafruit](https://www.adafruit.com/product/4079))
  - Some wire or bus bar to connect everything on the board ([Adafruit](https://www.adafruit.com/product/1311))
- Lights
  - 3V - 5V level shifter ([Adafruit](https://www.adafruit.com/product/1787) | [Mouser](https://www.mouser.com/ProductDetail/595-SN74AHCT125N))
  - RGB addressable LED strip ([Adafruit](https://www.adafruit.com/product/2241) | [Amazon](https://www.amazon.com/gp/product/B07BPX2KFD))
    - _Technically, WS281-based (like Neopixel) strips will work, which are cheaper, but I recommend SK9822-based (Dotstar) strips like this because they can refresh much faster and are more compatible with Raspberry Pis._
  - _**(Optional)**_ Some JST SM 4-pin connectors so you can (un)plug the LED strip from the board ([Adafruit](https://www.adafruit.com/product/578))
- Midi
  - DIN-5 (MIDI) jack ([Adafruit](https://www.adafruit.com/product/1134))
  - 6N138 Optocoupler ([Mouser](https://www.mouser.com/ProductDetail/859-6N138))
  - 1N4148 Diode ([Adafruit](https://www.adafruit.com/product/1641) | [Mouser](https://www.mouser.com/ProductDetail/512-1N4148))
  - Resistors: 1x 220Ω, 1x 1kΩ, 1x 10kΩ

### 2. Set up board

Start by planning our the circuit to connect everything on the board. I recommend first soldering the socket header to the side of your board, and if your Pi doesn't already have headers, solder some male headers in so you can plug the Pi into the board.

### 3. Power

Solder a barrel jack like  to your board and connect the ground and 5V pins to corresponding pins on both Raspberry Pi header and LED strip output.

### 4. Level shifter

While you _may_ not need to, a Raspberry Pi's 3V logic should be shifted to 5V in order to work reliably with LED strips.

Refer to:
- For Dotstar, refer to last bullet in Adafruit's [Dotstar guide](https://learn.adafruit.com/adafruit-dotstar-leds/power-and-connections)
- For Neopixels, [Neopixel guide](https://learn.adafruit.com/neopixels-on-raspberry-pi/raspberry-pi-wiring)
- Or for more general info about level shifters, their [level shifter guide](https://learn.adafruit.com/neopixel-levelshifter)

Slap one in your board and wire up to LED strip outputs and Raspberry Pi header as described in above guides (for Dotstar strips, use MOSI and SCLK pins for data and clock respectively, for Neopixels, use GPIO18 as described in guides).

### 5. MIDI Signal

I used [this](https://www.samplerbox.org/article/midiinwithrpi) guide exactly and it worked like a charm. I pray this page remains up forever 🙏. There are some useful comments about getting it to work on various Pis like the Raspberry Pi Zero W.

The directives I added to /boot/config.txt are also here in [config.txt](./config.txt)

### 6. Power it up

By now, you should be able to insert the Raspberry Pi into the socket on the board and plug everything in to power it on. You should see a blinky green light on the Pi.

Especially if you have a capacitor on the LED strip, make sure you plug strip in _**BEFORE**_ you plug in the power otherwise it may draw to much current and shut off the Pi.

## Software

### 1. Set up Pi

Follow a guide like [this](https://www.raspberrypi.com/documentation/computers/getting-started.html) to install Raspberry Pi OS. I recommend using [Raspberry Pi Imager](https://www.raspberrypi.com/software/), it's really easy.

I recommend installing "Raspberry Pi OS Lite" as you do not need the UI at all, and it will slow down your install process if you are using a Zero.

### 2. Install Node

Once you have logged into your Pi's console either directly or via SSH, install NodeJS.

On a recent PI (2+) nvm should work just fine:

```sh
sudo apt install -y nvm
nvm install 12 --lts
```

On a 1st gen Pi or Pi Zero W, you can install from unofficial builds like this:

```sh
wget https://nodejs.org/dist/latest-v10.x/node-v10.23.0-linux-armv6l.tar.xz
tar -xvf node-v10.23.0-linux-armv6l.tar.xz
sudo cp -R node-v10.23.0-linux-armv6l/* /usr/local/
```

### 3. Install TypeScript, and clone and build this package

```sh
npm i -g typescript
git clone https://github.com/benkrejci/midi-dudes.git
cd midi-dudes
tsc
```

### 4. Run to test

```sh
node midi-dudes/dist/midiDudes.js
```

If the stars aligned and everything is working, you should see the LED strip come on with the base color (dim blueish). If you're really lucky, plug in a keyboard and start playing, and everything will start lighting up.

### 5. Set up autostart

Presumably you'll want the script to run automatically when the Pi boots so you can just plug it in and play. I use pm2 to do this:

```sh
npm i -g pm2
pm2 start --name midi-dudes midi-dudes/dist/midiDudes.js
pm2 save
pm2 startup
```

After that last command, you may see additional instructions to allow pm2 to run on startup.

### 6. Tweak

There are a number of configuration parameters in [constants.ts](./constants.ts) which control things like the start and end notes of the light strip (`MIDI_NOTE_MIN` and `MIDI_NOTE_MAX`) and various aspects of the color algorithms. To modify, make the desired changes in constants.ts, and then rebuild and restart the script:

```sh
cd midi-dudes
# make desired changes in vi
vi constants.ts
# rebuild
tsc
# restart
pm2 restart midi-dudes
```

You can also edit `dist/constants.js` directly to avoid having to rebuild.