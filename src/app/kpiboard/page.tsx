import React from 'react';  
import LineChart from '@/components/linechart';

export default function kpiboard() {
    return (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-900 '>
      <div className="w-full h-fit max-w-xl rounded-xl ">
        <LineChart />
      </div>
       <div className="w-full h-fit max-w-xl rounded-xl ">
        <LineChart />
      </div>
       <div className="w-full h-fit max-w-xl rounded-xl ">
        <LineChart />
      </div>
      <div className="w-full h-fit max-w-xl rounded-xl ">
        <LineChart />
      </div>
       <div className="w-full h-fit max-w-xl rounded-xl ">
        <LineChart />
      </div>
      <div className="w-full h-fit max-w-xl rounded-xl ">
        <LineChart />
      </div>
        </div>
    )
}