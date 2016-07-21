import os
import sys
import numpy as np

import cv2

print "OpenCV version: %s" % cv2.__version__

inputFile = sys.argv[1] if len(sys.argv) > 1 else '768x576.mp4'
inputFile = 'input/' + inputFile

outputFile = os.path.join(os.getcwd(), 'result.mp4')

print "Input: %s" % inputFile
capture = cv2.VideoCapture(inputFile)

width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = int(capture.get(cv2.CAP_PROP_FPS))
fourcc = int(capture.get(cv2.CAP_PROP_FOURCC))
print "width=%r height=%r fps=%r fourcc=%x" % (width, height, fps, fourcc)

print "Output: %s" % outputFile

video = cv2.VideoWriter(outputFile, fourcc, fps, (width, height))

frames = 0
while True:
    flag, frame = capture.read() # Flag returns 1 for success, 0 for failure. Frame is the currently processed frame

    if flag == 0:  # Something is wrong with your data, or the end of the video file was reached
        break

    # write frame to output
    video.write(frame)

    if frames == 100:
        cv2.imwrite("frame_%05d.jpg" % frames, frame)
    frames += 1

print "Frames: %d" % frames
capture.release()
video.release()
print "Done!"
