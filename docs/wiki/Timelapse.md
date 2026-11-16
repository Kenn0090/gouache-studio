# Timelapse recorder

The recorder bar sits in the top row, next to the menus.

- **Record** starts a recording. While it records the button becomes **Pause**, and a red dot blinks. Press it again to resume.
- **Stop and save** (the square) ends the recording and makes the video. A recording only ends when you press this.
- **Replay** plays the timelapse chosen in the list beside it on top of the canvas. Press it again to pause. **Close** puts the canvas back.
- The **folder** button opens the folder of finished timelapses on the desktop app ("completed TL's"). In a browser it opens the list, where **Save a copy** puts a video in a folder.
- The **gear** opens the settings.

## What it records

A picture of the **whole canvas**, taken every so often, but only when something has changed since the last picture. In the settings you choose:

- **Pictures taken**: per second, per minute or per hour, and **how many** (1 to 60). Six per minute is one every ten seconds.
- **Compression**: smaller pictures (and a folder that lasts longer) at the cost of a little sharpness.
- **Picture size** (720 px up to full size) and **video speed** (pictures a second in the finished video).
- **Video quality**: **Small file**, **Balanced** (the default) or **Best picture**. The window shows about how many megabytes a minute of video takes; still parts of the picture take less.
- **Video format**: **Automatic** picks the tightest format your computer can make (AV1, then H.265, then VP9, then H.264). You can also choose one yourself. If a player cannot open the video, choose **MP4 · H.264**, which plays everywhere.

## Making a video even smaller with HandBrake (desktop app)

[HandBrake](https://handbrake.fr) is a separate free program that squeezes video much harder than Gouache can by itself. Each finished timelapse in the gear window has two buttons:

- **Compress** makes a smaller copy in the background. A note at the bottom of the window shows the percentage, with **Stop**. The copy is saved next to the video with **-small.mp4** at the end of its name, and the original is left alone. **Show smaller copy** opens its folder.
- **Open in HandBrake** opens the HandBrake window with the video loaded, so you can set everything yourself.

In the gear window, under **HandBrake**:

- **Compress as**: Smaller (H.265), Smallest but slower (AV1), Plays everywhere (H.264), or Fast on an NVIDIA card (H.265).
- **How small**: Smallest file, Balanced or Best picture.
- **Compress with HandBrake after every timelapse** does it by itself each time a video is made.
- **Find HandBrake…** lets you point at the program if Gouache did not find it.

What to install: **HandBrake** itself gives you **Open in HandBrake**. **Compress** needs HandBrake's command-line program, **HandBrakeCLI**, which is a separate download on handbrake.fr (Downloads › Command Line Version). Unzip it anywhere, press **Find HandBrake…** and choose HandBrakeCLI.exe. The browser version cannot start programs: use **Save a copy** there and open that file in HandBrake.

## If the app closes

The pictures are kept while you work. If the app closes or crashes, the unfinished recording is offered again in the gear window (**Resume**, **Make video** or **Delete**), and it resumes by itself when the document is recovered.

## Folder size

**Preferences › Files › Largest timelapse folder** (2000 MB to start with). When a recording reaches it, the oldest pictures are replaced.
