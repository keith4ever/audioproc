/*
 * Copyright (c) 2014 -     Keith Ha (keith4ever@gmail.com)
 * All content herein is protected by U.S. copyright and other applicable intellectual property laws
 * and may not be copied without the expressive permission of Keith Ha, who reserves all rights.
 * Reuse of any of the content for any purpose without the permission of Keith Ha
 * is strictly and expressively prohibited.
 */

#include "Queue.h"

Queue::Queue(): hEvent_(0)
        , nReadPosition_(0), nWritePosition_(0), nBuffersInQueue_(0)
        , bEndOfTask_(0)
{
    pthread_mutex_init(&oCriticalSection_, NULL);
    memset((void*)aIsFrameInUse_, 0, cnMaximumSize * sizeof(int));
    bQueueOverflow = false;
}

Queue::~Queue()
{
    pthread_mutex_destroy(&oCriticalSection_);
}

void
Queue::waitForQueueUpdate()
{
}

void
Queue::enter_CS(CRITICAL_SECTION *pCS)
{
    pthread_mutex_lock(pCS);
}


void
Queue::leave_CS(CRITICAL_SECTION *pCS)
{
    pthread_mutex_unlock(pCS);
}

void
Queue::set_event(HANDLE event)
{
}

void
Queue::reset_event(HANDLE event)
{
}

bool
Queue::isInUse(int nPictureIndex)
const
{
    assert(nPictureIndex >= 0);
    assert(nPictureIndex < (int)cnMaximumSize);

    return (0 != aIsFrameInUse_[nPictureIndex]);
}

bool
Queue::isEndOfTask()
const
{
    return (0 != bEndOfTask_);
}

void
Queue::endTask()
{
    bEndOfTask_ = true;
    signalStatusChange();  // Signal for the display thread
}

// Spins until frame becomes available or decoding
// gets canceled.
// If the requested frame is available the method returns true.
// If decoding was interupted before the requested frame becomes
// available, the method returns false.
bool
Queue::waitUntilFrameAvailable(int nPictureIndex)
{
    while (isInUse(nPictureIndex))
    {
        Sleep(1);   // Decoder is getting too far ahead from display
        if (isEndOfTask())
            return false;
    }

    return true;
}

void
Queue::signalStatusChange()
{
    set_event(hEvent_);
}