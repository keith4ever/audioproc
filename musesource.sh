#!/bin/sh

# ./pip.sh ipaddress filename1 filename2 filename3 filename3
# ./pip.sh kill

echo "==============================================="
echo "===== MuseLive WAV/FLAC source streaming ======"
echo "==============================================="
echo " "
echo "** Usage 1: Live feed (rtmp://<IP addr>:9981/muselive)"
echo " => $0 [filename] [ipaddress] "
echo "** Usage 2: kill all processes"
echo " => $0 kill"
echo " "

INPUTFILE=$1
IPADDR=$2
PORT="9981"

exitproc()
{
    printf "\nERROR: $1 Exiting..\n\n"
    exit -1
}

file_exists()
{
    if [ ! -f $1 ]; then
        FILEEXIST="No"
        exitproc "$1 doesn't exist in the folder.."
    else
        FILEEXIST="Yes"
    fi
}


run_pipsource()
{
    file_exists ${INPUTFILE}

    printf "file '%s'\n" ${INPUTFILE} > ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt
    printf "file '%s'\n" ${INPUTFILE} >> ${PORT}.txt

    CMD="sudo ffmpeg -f concat -safe 0 -re -i ${PORT}.txt -loglevel quiet \
    -c copy -f flac -listen 0 http://${IPADDR}:${PORT}/muselive "
   #-vcodec copy -acodec copy -f rtsp -rtsp_transport tcp rtsp://${IPADDR}:${PORT}/ac/live "
 
    echo "${CMD}"
    sudo ffmpeg -f concat -safe 0 -re -i ${PORT}.txt \
    -c copy -f flac -listen 0 http://${IPADDR}:${PORT}/muselive
   #-c copy -f rtsp -rtsp_transport tcp rtsp://${IPADDR}:${PORT}/ac/live 
 
   INPUT=""
}


if [ "$INPUTFILE" = "kill" ] 
then
    sudo killall -9 ffmpeg
    echo "killed all processes.. and exiting.."
    exit 0
fi

if [ -z "$IPADDR" ] 
then
    echo "IP address is not given.. using local IP address by default"
    IPADDR=`ip -o route get to 8.8.8.8 | sed -n 's/.*src \([0-9.]\+\).*/\1/p'`
    echo "Local IP address : $IPADDR"
fi

if [ -z "$PORT" ]
then
    echo "Input port number is not given.. using 9991 by default"
    PORT="9991"
fi


sudo ls > /dev/null

run_pipsource ${PORT} ${INPUTFILE} ${UUID} &
