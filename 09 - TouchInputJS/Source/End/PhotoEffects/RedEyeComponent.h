#pragma once

#include <collection.h>

namespace PhotoEffects
{
    public ref class RedEyeComponent sealed
    {
    public:
        RedEyeComponent();
        Windows::Foundation::Collections::IVector<unsigned char>^ RemoveRedEye(Windows::Foundation::Collections::IVector<unsigned char>^);
	};
}