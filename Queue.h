//
// Created by keith on 1/9/17.
//

#ifndef VIDEOENGINE_QUEUE_H
#define VIDEOENGINE_QUEUE_H

#include <chrono>
#include <thread>
#include <unistd.h>
#include <string.h>
#include <pthread.h>
#include <assert.h>

typedef pthread_mutex_t CRITICAL_SECTION;
typedef void* HANDLE;

#define Sleep(x) std::this_thread::sleep_for(std::chrono::milliseconds(x))

class Queue {
public:
    static const unsigned int cnMaximumSize = 30; // MAX_FRM_CNT;

    Queue();

    virtual
    ~Queue();

    void waitForQueueUpdate();
    void enter_CS(CRITICAL_SECTION *pCS);
    void leave_CS(CRITICAL_SECTION *pCS);
    void set_event(HANDLE event);
    void reset_event(HANDLE event);
    virtual void enqueue(const void * pData) = 0;

    // Deque the next frame.
    // Parameters:
    //      pDisplayInfo - New frame info gets placed into this object.
    //          Note: This pointer must point to a valid struct. The method
    //          does not create memory for this.
    // Returns:
    //      true, if a new frame was returned,
    //      false, if the queue was empty and no new frame could be returned.
    //          In that case, pPicParams doesn't contain valid data.
    virtual bool dequeue(void * pData) = 0;
    virtual void releaseFrame(const void * pPicParams) = 0;
    bool isInUse(int nPictureIndex)
            const;
    bool isEndOfTask() const;
    void endTask();

    // Spins until frame becomes available or decoding
    // gets canceled.
    // If the requested frame is available the method returns true.
    // If decoding was interupted before the requested frame becomes
    // available, the method returns false.
    bool waitUntilFrameAvailable(int nPictureIndex);
    size_t getPitch() { return nPitch; }
    bool isEmpty() { return nBuffersInQueue_ == 0; }
    int size()    {  return nBuffersInQueue_; }

protected:
    void signalStatusChange();

    HANDLE hEvent_;
    CRITICAL_SECTION    oCriticalSection_;
    volatile int        nReadPosition_;
    volatile int        nWritePosition_;

    volatile int        nBuffersInQueue_;
    volatile int        aIsFrameInUse_[cnMaximumSize];
    volatile int        bEndOfTask_;

    bool                bQueueOverflow;
    size_t              nPitch;
};


#endif //VIDEOENGINE_QUEUE_H
