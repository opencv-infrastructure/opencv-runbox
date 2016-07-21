cmake_minimum_required(VERSION 2.8.7)

project(app CXX)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

find_package(OpenCV REQUIRED)

include_directories(${OpenCV_INCLUDE_DIRS})

add_executable(app main.cpp)

target_link_libraries(app ${OpenCV_LIBS})
