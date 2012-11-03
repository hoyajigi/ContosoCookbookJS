using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Windows.ApplicationModel.Store;

namespace ContosoCookbook
{
    class ProductLicenseDataSource : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private const string _name = "ItalianRecipes";
        private bool _licensed = false;
        private string _price;

        public string GroupTitle
        {
            set
            {
                if (value != "Italian")
                    _licensed = true;
                else if (CurrentAppSimulator.LicenseInformation.ProductLicenses[_name].IsActive)
                    _licensed = true;
                else
                {
                    CurrentAppSimulator.LicenseInformation.LicenseChanged += OnLicenseChanged;
                    GetListingInformationAsync();
                }
            }
        }

        private async void GetListingInformationAsync()
        {
            var listing = await CurrentAppSimulator.LoadListingInformationAsync();
            _price = listing.ProductListings[_name].FormattedPrice;
        }
        
        private void OnLicenseChanged()
        {
            if (CurrentAppSimulator.LicenseInformation.ProductLicenses[_name].IsActive)
            {
                _licensed = true;
                CurrentAppSimulator.LicenseInformation.LicenseChanged -= OnLicenseChanged;

                if (PropertyChanged != null)
                {
                    PropertyChanged(this, new PropertyChangedEventArgs("IsLicensed"));
                    PropertyChanged(this, new PropertyChangedEventArgs("IsTrial"));
                }
            }
        }
        
        public bool IsLicensed
        {
            get { return _licensed; }
        }

        public bool IsTrial
        {
            get { return !_licensed; }
        }

        public string FormattedPrice
        {
            get
            {
                if (!String.IsNullOrEmpty(_price))
                    return "Purchase Italian Recipes for " + _price;
                else
                    return "Purchase Italian Recipes";
            }
        }
    }
}
