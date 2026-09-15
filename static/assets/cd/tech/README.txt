GLITCH ARCHIVE — emergency recovery disc
========================================

This disc is the image of the "tech" CD: an archive burned wrong.
The label on the medium does not match the volume name, the firmware
refuses to mount it as ordinary media, and all that is left is a
read-only iso9660 session plus an index you can open in emergency mode.

Where you are right now
-----------------------
  · emergency mode, no root
  · the disc is mounted read-only (ro)
  · some sectors are unreadable (I/O error)

What actually works
-------------------
  cat /mnt/cdrom/INDEX          the recovery manifest (start here)
  ls  /mnt/cdrom/projects       which projects are on the disc
  cat /mnt/cdrom/projects/<dir>/README.md
                                read a project's readme
                                (entries marked BAD SECTORS need recover first)
  recover <dir>                 rebuild a damaged entry
  help                          what is left of this machine

An honest note
--------------
  Most tools on this box are broken, and the errors are real:
  permissions, read-only media, bad sectors. Do not expect to repair
  anything — the point is only that you can still take the contents
  out, one piece at a time.
