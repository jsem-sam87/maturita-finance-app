import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking, StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Settings } from 'react-native';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

const PRIVACY_POLICY_URL = 'https://jsem-sam87.github.io/finance-tracker-app-privacy-policy/';

const handleOpenPrivacyPolicy = async () => {
  const supported = await Linking.canOpenURL(PRIVACY_POLICY_URL);
  if (supported) {
    await Linking.openURL(PRIVACY_POLICY_URL);
  }
};

//fixni kurzy k 1czk
const EXCHANGE_RATES = {
  CZK: 1.0,
  EUR: 0.040,
  USD: 0.044,
};
function convertCurrency(amount, fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return amount;
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  
  if (from === to) return amount;
  
  // prevod na czk a pak na cilovou menu
  const amountInCZK = amount / EXCHANGE_RATES[from];
  return amountInCZK * EXCHANGE_RATES[to];
}

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState('');
  const [session, setSession] = useState(null); //jestli je nekdo prihlaseny

  // Stavy pro finance
  const [transactions, setTransactions] = useState([]); //vsechny zaznamy
  const [balance, setBalance] = useState(0); // zustatek
  const [modalVisible, setModalVisible] = useState(false); // vyskakovaci okno na pridani zaznamu
  const [historyVisible, setHistoryVisible] = useState(false); // vyskakovaci okno na zobrazeni historie transakci 

  // Stavy pro novy zaznam
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState('income'); // income/expoence (incomo jako default)

  const [editingId, setEditingId] = useState(null); // null = pridavame novou, cislo = upravujeme stavajici

  const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense'

  const [settingsVisible, setSettingsVisible] = useState(false); 

  // dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Stavy pro meny
  const [defaultCurrency, setDefaultCurrency] = useState('CZK'); // vychozi mena
  const [txCurrency, setTxCurrency] = useState('CZK'); //mena prave zadane transakce

  const [defaultCurrencyModalVisible, setDefaultCurrencyModalVisible] = useState(false);
  const [txCurrencyModalVisible, setTxCurrencyModalVisible] = useState(false);

  //stavy pro kategorie
  const [userCategories, setUserCategories] = useState([]); // ulozeni kategorie z databaze
  const [txCategoryName, setTxCategoryName] = useState('Default'); // nazev kategorie pro novou transakci
  const [txCategoryIcon, setTxCategoryIcon] = useState('📦'); // ikona pro novou transakci
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('');

  const [editingCategoryId, setEditingCategoryId] = useState(null); // ID kategorie, kterou upravujeme

  // Výchozi hodnota 'all' zoberazi vsechny kategorie
  const [filterCategory, setFilterCategory] = useState('all');

  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');

  //stavy pro datum
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('userTheme');
        if (savedTheme !== null) setIsDarkMode(savedTheme === 'dark');
        
        const savedCurrency = await AsyncStorage.getItem('defaultCurrency');
        if (savedCurrency !== null) {
          setDefaultCurrency(savedCurrency);
          setTxCurrency(savedCurrency); 
        };
      } catch (e) {
        console.log('Error', e);
      }
    };
    loadSettings();
    getCategories();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem('userTheme', isDarkMode ? 'dark' : 'light');
      } catch (e) {
        console.log('Chyba při ukládání motivu:', e);
      }
    };
    saveTheme();
  }, [isDarkMode]);

  useEffect(() => {
  if (!session) return; 

    const saveCurrency = async () => {
      try {
        await AsyncStorage.setItem('defaultCurrency', defaultCurrency);
        // setTxCurrency(defaultCurrency);
        getTransactions();
      } catch (e) {
        console.log('Error saving default currency:', e);
      }
    };
    saveCurrency();
  }, [defaultCurrency, session]);

  async function getTransactions() {
    if(!session) return;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id) //nacte pouze data uzivatele, ktery je prihlasen
      .order('created_at', {ascending: false});

      if (error) {
      console.log('Error getting data:', error.message);
      } else {
        setTransactions(data);

        // spocitani zustatku
        let totalbalance = 0;
        data.forEach(item => {
          // zjisteni meny transakce
          const itemCurrency = item.currency || 'CZK';
          // prepocitani castky do vychozi meny
          const convertedAmount = convertCurrency(Number(item.amount), itemCurrency, defaultCurrency);

          if (item.type == 'income') totalbalance += convertedAmount;
          if (item.type == 'expense') totalbalance -= convertedAmount;
        });
        setBalance(parseFloat(totalbalance.toFixed(2)));
      }
  }

  //ziskani dat kategorii uzivatele z databaze
async function getCategories() {
  if (!session) return;
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error loading categories', error.message);
  } else {
    // pridani default kategorie
    const defaultCat = { id: 'default', name: 'Default', icon: '📦' };
    setUserCategories([defaultCat, ...data]);
  }
}

// vytvoreni nove kategorie uzivatelem
async function handleCreateCategory(name, icon) {
  if (!name.trim()) return;
  const { error } = await supabase
    .from('categories')
    .insert([{ name: name, icon: icon || '💰' }]);

  if (error) {
    Alert.alert("Error creating category", error.message);
  } else {
    getCategories(); 
  }
}

function handleLongPressCategory(cat) {
  if (cat.id === 'default') return; //default nelze smazat
  setEditingCategoryId(cat.id);
  setNewCatName(cat.name);
  setNewCatIcon(cat.icon);
}

async function updateCategoryInDb(id, name, icon) {
  if (!session) return;

  const oldCat = userCategories.find(c => c.id === id);
  if (!oldCat) return;

  const { error: catError } = await supabase
    .from('categories')
    .update({ name: name, icon: icon })
    .eq('id', id)
    .eq('user_id', session.user.id); 

  if (catError) {
    Alert.alert("Error", catError.message);
    return;
  }

  await supabase
    .from('transactions')
    .update({ category_name: name, category_icon: icon })
    .eq('category_name', oldCat.name)
    .eq('user_id', session.user.id);

  getCategories(); 
  getTransactions(); 
}

async function deleteCategory(id) {
  if (!session) return;

  const catToDelete = userCategories.find(c => c.id === id);
  if (!catToDelete) return;

  Alert.alert(
    "Delete Category",
    "Are you sure? All transactions with this category will change to 'Default'.",
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive",
        onPress: async () => {
          const { error: deleteError } = await supabase
            .from('categories')
            .delete()
            .eq('id', id)
            .eq('user_id', session.user.id);

          if (deleteError) {
            Alert.alert("Error", deleteError.message);
            return;
          }

          await supabase
            .from('transactions')
            .update({ category_name: 'Default', category_icon: '📦' })
            .eq('category_name', catToDelete.name)
            .eq('user_id', session.user.id);

          setTxCategoryName('Default');
          setTxCategoryIcon('📦');
          getCategories();  
          getTransactions();
        }
      }
    ]
  );
}
  //okamzite nacteni dat po prihlaseni uzivatele
  useEffect(() => {
    if (session) {
      getTransactions();
      getCategories()
    }
  }, [session, defaultCurrency]);

  async function handleAddTransaction() {
    if (!txTitle || !txAmount) {
      Alert.alert("Error", "Please fill in both the name and the amount..");
      return;
    }

    const formattedAmount = txAmount.replace(',', '.');
    const finalAmount = Math.abs(parseFloat(formattedAmount));
    if (isNaN(finalAmount) || finalAmount <= 0) {
      Alert.alert("Chyba", "Please enter a valid positive amount (E.g. 19.90 or 19,90).");
      return;
    }

    const dateToSave = selectedDate ? selectedDate.toISOString() : new Date().toISOString();

    if (editingId) {
      // rezim upravty zaznamu
      const { error } = await supabase
        .from('transactions')
        .update({
          title: txTitle,
          amount: finalAmount,
          type: txType,
          category_name: txCategoryName,
          category_icon: txCategoryIcon,
          currency: txCurrency,
          created_at: dateToSave,
        })
        .eq('id', editingId);

      if (error) {
        Alert.alert("Chyba při úpravě", error.message);
        return;
      }
    } else {
      //rezim pridani zaznamu
      const { error } = await supabase
        .from('transactions')
        .insert([
          { 
            title: txTitle, 
            amount: finalAmount, 
            type: txType,
            currency: txCurrency,
            category_name: txCategoryName,
            category_icon: txCategoryIcon,
            created_at: dateToSave
          }
        ]);

      if (error) {
        Alert.alert("Error while saving", error.message);
        return; 
      }
    }  

    setTxTitle('');
    setTxAmount('');
    setTxCurrency(defaultCurrency);
    setTxCategoryName('Default');
    setTxCategoryIcon('📦');
    setSelectedDate(new Date());
    setEditingId(null);
    setModalVisible(false);
    getTransactions(); //prepocteni zustatku
    
  }


  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both your email and password.")
      return;
    }

    setLoading(true);

    const {data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message);
    }
    // else {
    //   Alert.alert("Success", "Welcome back!")
    // }
  }

  async function handleSignUp() {
      if (!email || !password) {
        Alert.alert("Error", "Please enter both your email and password.")
        return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Registion failed', error.message);
    } else {
      Alert.alert('Success!', 'Your account was created successfully.');
    }
  }

  async function handleSignOut(){
    await supabase.auth.signOut();
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete account and data",
      "Are you sure u want to delelte yout account with all your data? This action can't be undone!",
      [
        { text: "Cancel" },
        { 
          text: "Delete Account", 
          onPress: async () => {
            try {
              setLoading(true);

              const { error } = await supabase.rpc('delete_user_account');

              if (error) {
                throw new Error("Error deleting account: " + error.message);
              }

              await supabase.auth.signOut();
              
              setSettingsVisible(false);
              
              Alert.alert("Account deleted", "Your account and all your data was deleted");
            } catch (error) {
              Alert.alert("Error", error.message);
            } finally {
              setLoading(false);
            }
          } 
        }
      ]
    );
  }

  function handleOpenEdit(item) {
    setEditingId(item.id);
    setTxTitle(item.title);
    setTxAmount(item.amount.toString());
    setTxCurrency(item.currency || 'CZK');
    txType === item.type;
    setTxCategoryName(item.category_name || 'Default');
    setTxCategoryIcon(item.category_icon || '📦');

    setSelectedDate(item.created_at ? new Date(item.created_at) : new Date());

    setHistoryVisible(false);
    setModalVisible(true);
  }

  async function handleDeleteTransaction() {
    if (!editingId) return;

    Alert.alert(
      "Delete record",
      "Do you really want to delete this record?",
      [
        { text: "Zrušit", style: "cancel" },
        { 
          text: "Delete", 
          onPress: async () => {
            const { error } = await supabase
              .from('transactions')
              .delete()
              .eq('id', editingId);

            if (error) {
              Alert.alert("Error deleting transaction", error.message);
            } else {
              // Resetovani formulare
              setTxTitle('');
              setTxAmount('');
              setEditingId(null);
              setModalVisible(false);
              getTransactions();
            }
          } 
        }
      ]
    );
  }

  const handleOpenAdd = () => {
    setEditingId(null);
    setTxTitle('');
    setTxAmount('');
    setTxCurrency(defaultCurrency);
    setTxCategoryName('Default');
    setTxCategoryIcon('📦');
    setSelectedDate(new Date())
    setModalVisible(true);
  };

  const availableMonths = getAvailableMonths(transactions, 'en');

  const filteredTransactions = transactions.filter(tx => {
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesCategory = filterCategory === 'all' || tx.category_name === filterCategory;
    const itemMonth = formatMonthYear(tx.created_at, 'en');
    const matchesMonth = selectedMonthFilter === 'all' || itemMonth === selectedMonthFilter;

    return matchesType && matchesCategory && matchesMonth;
  }).sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();

    if (dateB !== dateA) {
      return dateB - dateA;
    }
    return b.id - a.id;
  });

  function formatMonthYear(dateString, lang = 'en') {
    if (!dateString) return '';
    const d = new Date(dateString);
    
    const formatted = d.toLocaleString(lang, { month: 'long', year: 'numeric' });
    
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function getAvailableMonths(transactionsList, lang = 'en') {
    const monthsSet = new Set();

    const sorted = [...transactionsList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    sorted.forEach(tx => {
      if (tx.created_at) {
        monthsSet.add(formatMonthYear(tx.created_at, lang));
      }
    });

    return Array.from(monthsSet);
  }

  const handleDateChange = (event, selectedDateFromPicker) => {
  if (Platform.OS === 'android') {
    setShowDatePicker(false);
  }

  if (event.type === 'set' && selectedDateFromPicker) {
    setSelectedDate(selectedDateFromPicker);
  }

  if (Platform.OS === 'ios') {
    setShowDatePicker(false);
  }
};

  //vypocet castky za urcity mesic
  const mainPageMonthTransactions = transactions.filter(tx => {
    const itemMonth = formatMonthYear(tx.created_at, 'en');
    return selectedMonthFilter === 'all' || itemMonth === selectedMonthFilter;
  });

  const monthlySummary = mainPageMonthTransactions.reduce(
    (acc, tx) => {
      const rawAmount = Number(tx.amount) || 0;
      const txCurrency = tx.currency || 'CZK';

      const convertedAmount = convertCurrency(rawAmount, txCurrency, defaultCurrency);

      if (tx.type === 'income') {
        acc.income += convertedAmount;
      } else if (tx.type === 'expense') {
        acc.expenses += convertedAmount;
      }
      return acc;
    },
    { income: 0, expenses: 0 }
  );

  //progress bary
  const maxAmount = Math.max(monthlySummary.income, monthlySummary.expenses, 1);

  const incomeWidth = `${Math.min(100, Math.round((monthlySummary.income / maxAmount) * 100))}%`;
  const expenseWidth = `${Math.min(100, Math.round((monthlySummary.expenses / maxAmount) * 100))}%`;

  // 1. Spočítáme výdaje podle kategorií pro vybraný měsíc
  const categoryTotals = mainPageMonthTransactions
    .filter(tx => tx.type === 'expense')
    .reduce((acc, tx) => {
      const catName = tx.category_name || 'Ostání';
      const catIcon = tx.category_icon || '📦';
      const rawAmount = Number(tx.amount) || 0;
      const txCurrency = tx.currency || 'CZK';

      const convertedAmount = convertCurrency(rawAmount, txCurrency, defaultCurrency);

      if (!acc[catName]) {
        acc[catName] = { name: catName, icon: catIcon, total: 0 };
      }
      acc[catName].total += convertedAmount;
      return acc;
    }, {});

  const totalExpenses = monthlySummary.expenses || 1;

  const categoriesArray = Object.values(categoryTotals)
    .map(cat => ({
      ...cat,
      total: parseFloat(cat.total.toFixed(2)),
      percentage: Math.round((cat.total / totalExpenses) * 100),
    }))
    .sort((a, b) => b.total - a.total); 

  const colors = isDarkMode ? theme.dark : theme.light;


  // ***** Pages *****
  // --- Main page ---

  if (session) {
    return(   
        <View style={[styles.container, {backgroundColor: colors.background}]}>
          <View style={styles.headerRow}>
            <Text style={[styles.mainPageTitle, { color: colors.primary }]}>Main page</Text>
            
            {/* <TouchableOpacity 
              style={styles.themeToggle}
              onPress={() => setIsDarkMode(!isDarkMode)}
            >
              <Text style={{ fontSize: 24 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>  */}
            <TouchableOpacity 
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={{ fontSize: 24, color: colors.text }}>⚙️</Text>
            </TouchableOpacity>

        </View>
        <ScrollView 
          style={{ width: '100%', marginBottom: 20, }}
          contentContainerStyle={{ 
            alignItems: 'center',
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: colors.text }}>Welcome {session.user.email}</Text>
          <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 }}>
                CURRENT BALANCE:
            </Text>
            <Text style={{ color: colors.primary, fontSize: 36, fontWeight: '800', marginTop: 10 }}>
                {balance} {defaultCurrency}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleOpenAdd}>
              <Text style={styles.primaryButtonText}>+ Add record</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => {   setHistoryVisible(true);
              setFilterType('all');
              setFilterCategory('all');
              setSelectedMonthFilter('all');
            }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Show history</Text>
            </TouchableOpacity>
            
          </View>
            <View style={[styles.summaryContainer, {backgroundColor: colors.background, borderColor: colors.border}]}>
              <View style={{ height: 40, marginBottom: 12 }}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={{ alignItems: 'center' }}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedMonthFilter('all')}
                    style={[
                      styles.monthFilterBadge,
                      { backgroundColor: selectedMonthFilter === 'all' ? '#3b82f6' : 'transparent', borderColor: colors.border }
                    ]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
                      All Time
                    </Text>
                  </TouchableOpacity>

                  {availableMonths.map((monthString, index) => {
                    const isSelected = selectedMonthFilter === monthString;
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setSelectedMonthFilter(monthString)}
                        style={[
                          styles.monthFilterBadge,
                          { backgroundColor: isSelected ? '#3b82f6' : 'transparent', borderColor: colors.border }
                        ]}
                      >
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
                          {monthString}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: '#22c55e' }]}>
                  Incomes: {parseFloat(monthlySummary.income.toFixed(2)).toLocaleString('cs-CZ')} {defaultCurrency}
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: incomeWidth, backgroundColor: '#22c55e' }]} />
              </View>
              
                <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: '#ef4444' }]}>
                  Expenses: {parseFloat(monthlySummary.expenses.toFixed(2)).toLocaleString('cs-CZ')} {defaultCurrency}
                </Text>
              </View>
              
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: expenseWidth, backgroundColor: '#ef4444' }]} />
              </View>

              {categoriesArray.length > 0 && (
              <View style={styles.categoriesSection}>
                <View style={[styles.divider, {backgroundColor: colors.text}]} />
                  <Text style={[styles.categoriesTitle, {color: colors.primary}]}>Expenses Breakdown</Text>

                  {categoriesArray.map((cat, idx) => (
                  <View key={idx} style={styles.catRow}>
                    <View style={styles.catInfoRow}>
                      <Text style={[styles.catName, {color: colors.text}]}>
                        {cat.icon} {cat.name}
                      </Text>
                      <Text style={[styles.catAmount, {color: colors.text}]}>
                        {cat.total.toLocaleString('cs-CZ')} {defaultCurrency} ({cat.percentage}%)
                      </Text>
                    </View>
                    {/* Mini progress bar pro konkretni categorii*/}
                    <View style={styles.miniBarTrack}>
                      <View style={[styles.miniBarFill, { width: `${cat.percentage}%`, backgroundColor: colors.primary }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            </View>

        </ScrollView> 

      {/* <TouchableOpacity style={[ styles.signOutButton, {borderColor: colors.border}]} onPress={handleSignOut}>
        <Text style={{ color: colors.text, fontWeight: '600',}}>Sign Out</Text>
      </TouchableOpacity> */}

    {/* --- Add record page --- */}

        <Modal visible={modalVisible} animationType="slide" transparent={false} onRequestClose={() => {
        setModalVisible(false);}}
        >
          <View style={[styles.container, {backgroundColor: colors.background, paddingTop: 20}]}>
            <View style={styles.headerRow}>
              <Text style={[styles.recordPageTitle, { color: colors.primary }]}>{editingId ? "Edit record:" : "New record:"}</Text>
            </View>
            <View style={styles.contentContainer}>
              <View style={styles.recordPageRow}>
                <Text style={{ color: colors.primary, fontSize: 18 }}>Name:</Text>
                <TextInput
                  style={{ color: colors.text, fontSize: 18, flex: 1 }}
                  placeholder="E.g. Salary, Groceries..."
                  placeholderTextColor={colors.textMuted}
                  value={txTitle} 
                  onChangeText={setTxTitle}
                />
              </View>

              <View style={styles.recordPageRow}>
                <Text style={{ color: colors.primary, fontSize: 18 }}>Amount:</Text>
                <TextInput 
                  style={{ color: colors.text, fontSize: 18, flex: 1 }}
                  placeholder="0" 
                  placeholderTextColor={colors.textMuted}
                  value={txAmount} 
                  onChangeText={setTxAmount}
                  keyboardType="numeric"
                />
                {/* tlacitko pro vyber meny*/}
                <TouchableOpacity
                  onPress={() => setTxCurrencyModalVisible(true)}
                  style={[styles.txCurrencyDropdownTrigger, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginRight: 5 }}>
                    {txCurrency}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>

                {/*  MODAL/DROPDOWN PRO vyber meny transakce*/}
                <Modal
                  visible={txCurrencyModalVisible}
                  transparent={true}
                  animationType="fade"
                  onRequestClose={() => setTxCurrencyModalVisible(false)}
                >
                  <TouchableOpacity 
                    style={styles.dropdownOverlay} 
                    activeOpacity={1} 
                    onPress={() => setTxCurrencyModalVisible(false)}
                  >
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.dropdownTitle, { color: colors.primary }]}>Select Currency</Text>
                      {['CZK', 'EUR', 'USD'].map((curr) => (
                        <TouchableOpacity
                          key={curr}
                          style={[
                            styles.dropdownOption,
                            { 
                              backgroundColor: txCurrency === curr ? '#3b82f6' : 'transparent',
                              borderBottomColor: colors.border
                            }
                          ]}
                          onPress={() => {
                            setTxCurrency(curr);
                            setTxCurrencyModalVisible(false);
                          }}
                        >
                          <Text style={{ 
                            color: txCurrency === curr ? '#fff' : colors.text, 
                            fontSize: 16, 
                            fontWeight: '600' 
                          }}>
                            {curr}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                </Modal>
                
              </View>  

              {/* <Text style={{ color: colors.text }}>Transaction type:</Text> */}
              <View style={styles.incomeExpenseRow}>
                <TouchableOpacity 
                  onPress={() => setTxType('income')}
                  style={[ styles.incomeExpenseButton, {borderColor: colors.border, backgroundColor: txType === 'income' ? '#3b82f6' : '#00000000'}]}
                >
                  <Text style={{ color: colors.text, fontSize: 18 }}>Income</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setTxType('expense')}
                  style={[ styles.incomeExpenseButton, {borderColor: colors.border, backgroundColor: txType === 'expense' ? '#3b82f6' : '#00000000'}]}
                >
                  <Text style={{ color: colors.text, fontSize: 18 }}>Expense</Text>
                </TouchableOpacity>
              </View>
                <View style={styles.categoriesSectionContainer}>

                  <Text style={{ color: colors.primary, fontSize: 18, marginBottom: 5 }}>
                    Categories:
                  </Text>
                  
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.categoriesScroll}
                  >
                    {userCategories.map((cat, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          setTxCategoryName(cat.name);
                          setTxCategoryIcon(cat.icon);
                        }}
                        onLongPress={() => handleLongPressCategory(cat)}
                        delayLongPress={500}
                        style={[
                          styles.categoryBadge,
                          { borderColor: colors.border, backgroundColor: txCategoryName === cat.name ? '#3b82f6' : 'transparent' }
                        ]}
                      >
                        <Text style={styles.categoryBadgeIcon}>{cat.icon}</Text>
                        <Text 
                          style={[
                            styles.categoryBadgeText, 
                            { color: txCategoryName === cat.name ? '#fff' : colors.text }
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={styles.addCategoryRow}>
                    <TextInput
                      placeholder="💰"
                      placeholderTextColor="#888"
                      maxLength={2}
                      value={newCatIcon}
                      onChangeText={setNewCatIcon}
                      style={[styles.iconInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                    />
                    <TextInput
                      placeholder="new category..."
                      placeholderTextColor="#888"
                      value={newCatName}
                      onChangeText={setNewCatName}
                      style={[styles.nameInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (newCatName.trim()) {
                          if (editingCategoryId) {
                            updateCategoryInDb(editingCategoryId, newCatName, newCatIcon || '💰');
                          } else {
                            handleCreateCategory(newCatName, newCatIcon || '💰');
                          }
                          setNewCatName('');
                          setNewCatIcon('');
                          setEditingCategoryId(null);
                        }
                      }}
                      style={[
                        styles.addCategoryButton, 
                        { backgroundColor: editingCategoryId ? '#f59e0b' : '#10b981' }
                      ]}
                    >
                      <Text style={styles.addCategoryButtonText}>
                        {editingCategoryId ? 'Edit' : 'Add'}
                      </Text>
                    </TouchableOpacity>

                    {editingCategoryId && (
                      <TouchableOpacity
                        onPress={() => {
                          deleteCategory(editingCategoryId);
                          setNewCatName('');
                          setNewCatIcon('');
                          setEditingCategoryId(null); 
                        }}
                        style={{
                          backgroundColor: '#ef4444',
                          paddingHorizontal: 12,
                          height: 38,
                          borderRadius: 8,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginLeft: 6
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                    <Text style={{ color: colors.primary, fontSize: 18, marginTop: 5 }}>
                    Date: 
                  </Text>
                    <TouchableOpacity 
                      onPress={() => setShowDatePicker(true)}
                      style={[styles.categoryBadge, { borderColor: colors.border, marginTop: 10, alignSelf: 'flex-start' }]}
                    >
                      <Text style={styles.categoryBadgeIcon}>📅</Text>
                      <Text style={[styles.categoryBadgeText, { color: colors.text }]}>
                        {selectedDate.toLocaleDateString('cs-CZ')}
                      </Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                      />
                    )}
                </View>

            </View>

            <View style={styles.rocordPageBottomContainer}>
            {editingId && (
              <TouchableOpacity onPress={handleDeleteTransaction} style={[styles.deleteRecordButton, {borderColor: colors.border, marginTop: 15}]}>
                  <Text style={{ color: colors.text }}>Delete record</Text>
              </TouchableOpacity>
              )}

              <TouchableOpacity onPress={handleAddTransaction}
              style={[styles.saveRecordButton, {borderColor: colors.border}]}>
                <Text style={{ color: colors.text }}>Save record</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setModalVisible(false); setEditingId(null); setTxTitle(''); setTxAmount(''); }}
              style={[styles.cancelRecordButton, {borderColor: colors.border}]}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
            </View>  
          </View>
        </Modal>

    {/* --- Transaction history page --- */}

        <Modal visible={historyVisible} animationType="slide" transparent={false} onRequestClose={() => {
        setHistoryVisible(false);}}
        >
          <View style={[styles.container, {backgroundColor: colors.background, paddingTop: 20}]}>
            <View style={styles.headerRow}>
              <Text style={[styles.historyPageTitle, { color: colors.primary }]}>Transaction history:</Text>
            </View>

            <View style={styles.historyFilterRow}>
              {/* --- TLAČÍTKO VŠE --- */}
              <TouchableOpacity 
                onPress={() => setFilterType('all')}
                style={[ 
                  styles.historyFilterButton, 
                  {
                    borderColor: colors.border, 
                    backgroundColor: filterType === 'all' ? '#3b82f6' : '#00000000'
                  }
                ]}
              >
                <Text style={{ 
                  color: filterType === 'all' ? '#ffffff' : colors.text, 
                  fontSize: 16, 
                  fontWeight: '600' 
                }}>
                  All
                </Text>
              </TouchableOpacity>

              {/* --- TLAČÍTKO PŘÍJMY --- */}
              <TouchableOpacity 
                onPress={() => setFilterType('income')}
                style={[ 
                  styles.historyFilterButton, 
                  {
                    borderColor: colors.border, 
                    backgroundColor: filterType === 'income' ? '#3b82f6' : '#00000000'
                  }
                ]}
              >
                <Text style={{ 
                  color: filterType === 'income' ? '#ffffff' : colors.text, 
                  fontSize: 16, 
                  fontWeight: '600' 
                }}>
                  Incomes
                </Text>
              </TouchableOpacity>

              {/* --- TLAČÍTKO VÝDAJE --- */}
              <TouchableOpacity 
                onPress={() => setFilterType('expense')}
                style={[ 
                  styles.historyFilterButton, 
                  {
                    borderColor: colors.border, 
                    backgroundColor: filterType === 'expense' ? '#3b82f6' : '#00000000'
                  }
                ]}
              >
                <Text style={{ 
                  color: filterType === 'expense' ? '#ffffff' : colors.text, 
                  fontSize: 16, 
                  fontWeight: '600' 
                }}>
                  Expenses
                </Text>
              </TouchableOpacity> 

            </View>

            <View style={{ width: '90%', marginBottom: 5, height: 42 }}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                nestedScrollEnabled={true}
                contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 10 }}
              >
                <TouchableOpacity
                  onPress={() => setFilterCategory('all')}
                  style={[
                    styles.categoryBadge,
                    { 
                      borderColor: colors.border, 
                      backgroundColor: filterCategory === 'all' ? '#3b82f6' : 'transparent' 
                    }
                  ]}
                >
                  <Text style={styles.categoryBadgeIcon}>🌐</Text>
                  <Text 
                    style={[
                      styles.categoryBadgeText, 
                      { color: filterCategory === 'all' ? '#fff' : colors.text }
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>

                {userCategories.map((cat, index) => {
                  const isSelected = filterCategory === cat.name;
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setFilterCategory(cat.name)}
                      style={[
                        styles.categoryBadge,
                        { 
                          borderColor: colors.border, 
                          backgroundColor: isSelected ? '#3b82f6' : 'transparent' 
                        }
                      ]}
                    >
                      <Text style={styles.categoryBadgeIcon}>{cat.icon}</Text>
                      <Text 
                        style={[
                          styles.categoryBadgeText, 
                          { color: isSelected ? '#fff' : colors.text }
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ width: '90%', marginVertical: 4, height: 42 }}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                nestedScrollEnabled={true}
                contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 10 }}
              >
                <TouchableOpacity
                  onPress={() => setSelectedMonthFilter('all')}
                  style={[
                    styles.categoryBadge,
                    { 
                      borderColor: colors.border, 
                      backgroundColor: selectedMonthFilter === 'all' ? '#3b82f6' : 'transparent' 
                    }
                  ]}
                >
                  <Text style={styles.categoryBadgeIcon}>📅</Text>
                  <Text 
                    style={[
                      styles.categoryBadgeText, 
                      { color: selectedMonthFilter === 'all' ? '#fff' : colors.text }
                    ]}
                  >
                    All Time
                  </Text>
                </TouchableOpacity>

                {availableMonths.map((monthString, index) => {
                  const isSelected = selectedMonthFilter === monthString;
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setSelectedMonthFilter(monthString)}
                      style={[
                        styles.categoryBadge,
                        { 
                          borderColor: colors.border, 
                          backgroundColor: isSelected ? '#3b82f6' : 'transparent' 
                        }
                      ]}
                    >
                      <Text 
                        style={[
                          styles.categoryBadgeText, 
                          { color: isSelected ? '#fff' : colors.text }
                        ]}
                      >
                        {monthString}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            
            <ScrollView
            style={styles.historyScrollView}
            contentContainerStyle={styles.historyScrollContent}
            showsVerticalScrollIndicator={true}
            >
              {filteredTransactions.length === 0 ? (
                <Text style={{ color: colors.text }}>You don't have any records with this filter here yet.</Text>
              ) : (
                filteredTransactions.map((item) =>  (
                  <TouchableOpacity key={item.id} onPress={() => handleOpenEdit(item)}>
                    <View style={styles.historyRecordRow}>
                      <Text style={{ color: colors.primary, fontSize: 16, paddingHorizontal: 5}}>{item.title}</Text>
                      <Text style={{ color: colors.text, fontSize: 16, paddingHorizontal: 5}}>
                        {item.type === 'income' ? '+' : '-'}{item.amount} {item.currency || 'CZK'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity onPress={() => {
              setHistoryVisible(false);
              setFilterType('all');
              setFilterCategory('all');
              setSelectedMonthFilter('all');}}
              style={[styles.closeHistoryButton, {borderColor: colors.border }]}>
              <Text style={{ color: colors.text}}>Close history</Text>
            </TouchableOpacity>
          </View>
        </Modal>
        
      {/* --- Settings page --- */}
        <Modal visible={settingsVisible} animationType="slide" transparent={false} onRequestClose={() => { setSettingsVisible(false); }}
          >
          <View style={[styles.container, { backgroundColor: colors.background, paddingTop: 20}]}>
            <View style={styles.headerRow}>
              <Text style={[styles.settingsPageTitle, { color: colors.primary}]}>
                Settings
              </Text>
            </View>

            <View style={styles.settingsContent}>
            {/* vychozi mena */}
              <View style={[styles.settingsRow, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 18, paddingHorizontal: 10}}>Default Currency:</Text>
              <TouchableOpacity
                onPress={() => setDefaultCurrencyModalVisible(true)}
                style={[styles.dropdownTrigger, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginRight: 8 }}>
                  {defaultCurrency}
                </Text>
                <Text style={{ color: colors.text, fontSize: 12 }}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* MODAL/DROPDOWN PRO vyber dafeult meny */}
            <Modal
              visible={defaultCurrencyModalVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setDefaultCurrencyModalVisible(false)}
            >
              <TouchableOpacity 
                style={styles.dropdownOverlay} 
                activeOpacity={1} 
                onPress={() => setDefaultCurrencyModalVisible(false)}
              >
                <View style={[styles.dropdownMenu, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.dropdownTitle, { color: colors.primary,  }]}>Select Default Currency</Text>
                  {['CZK', 'EUR', 'USD'].map((curr) => (
                    <TouchableOpacity
                      key={curr}
                      style={[
                        styles.dropdownOption,
                        { 
                          backgroundColor: defaultCurrency === curr ? '#3b82f6' : 'transparent',
                          borderBottomColor: colors.border
                        }
                      ]}
                      onPress={() => {
                        setDefaultCurrency(curr);
                        setTxCurrency(curr);
                        setDefaultCurrencyModalVisible(false);
                      }}
                    >
                      <Text style={{ 
                        color: defaultCurrency === curr ? '#fff' : colors.text, 
                        fontSize: 16, 
                        fontWeight: '600' 
                      }}>
                        {curr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>

            {/* light/dark mode */}
            <View style={[styles.settingsRow, { borderColor: colors.border, borderColor: colors.border }]}>
              <Text style={{ paddingHorizontal: 10, color: colors.text, fontSize: 18 }}>Theme:</Text>
              <TouchableOpacity 
                style={styles.themeToggle}
                onPress={() => setIsDarkMode(!isDarkMode)}
              >
                <Text style={{ fontSize: 24, color: colors.text, margin: 5 }}>{isDarkMode ? 'Light ☀️' : 'Dark 🌙'}</Text>
              </TouchableOpacity> 
            </View>

          </View>

            <View style={styles.settingsActions}>
              
              <TouchableOpacity 
                onPress={() => {
                  setSettingsVisible(false);
                  handleSignOut();
                }}
                style={[styles.settingsActionButton, { borderColor: colors.border, backgroundColor: '#ef4444' }]}
              >
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                  Sign Out
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleDeleteAccount}
                style={[styles.settingsActionButton, { borderColor: colors.border}]}
              >
                <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>
                  Delete Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setSettingsVisible(false)}
                style={[styles.settingsActionButton, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                  Close Settings
                </Text>
              </TouchableOpacity>
            </View>
              <TouchableOpacity 
                style={{ paddingVertical: 12, alignItems: 'center'}}
                onPress={handleOpenPrivacyPolicy}
              >
                <Text style={{ color: colors.primary, textDecorationLine: 'underline', fontSize: 13 }}>
                  Privacy Policy & Terms of Use
                </Text>
              </TouchableOpacity>


          </View>
        </Modal>

      </View>
    )
  }

  // -- Login page ---

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.headerRow}>
        <Text style={[styles.loginPageTitle, { color: colors.primary }]}>Finance Tracker App</Text>
        <TouchableOpacity 
          style={styles.themeToggle}
          onPress={() => setIsDarkMode(!isDarkMode)}
        >
          <Text style={{ fontSize: 24 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>          
      </View>
      <View style={styles.logInPageContainer}>
        <View style={styles.logInPageRow}>
          <Text style={{ color: colors.primary, fontSize: 18 }}>E-mail:</Text>
          <TextInput
            style={{ color: colors.text, fontSize: 18, flex: 1 }}
            placeholder="name@email.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={(text) => setEmail(text)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.logInPageRow}>
          <Text style={{ color: colors.primary, fontSize: 18 }}>password:</Text>
          <TextInput
              style={{ color: colors.text, fontSize: 18, flex: 1}}
              placeholder="_____"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(text) => setPassword(text)}
              secureTextEntry={true}
              autoCapitalize="none"
          />
        </View>
      </View>  
      <TouchableOpacity
        onPress={handleLogin}
        style={[styles.logInButton, {borderColor: colors.border}]}
        // disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#f2f2f2" }}>Login</Text>
          )}
      </TouchableOpacity>


      <TouchableOpacity 
        onPress={handleSignUp}
        style={[styles.signUpButton, {borderColor: colors.border}]}
        // disabled={loading}
      >
        <Text style={{ color: "#f2f2f2" }}>SignUp</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />

      <Text style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', marginBottom: 15 }}>
          By continuing, you agree to our{' '}
          <Text 
            style={{ color: colors.primary, textDecorationLine: 'underline' }}
            onPress={handleOpenPrivacyPolicy}
          >
            Privacy Policy & Terms
          </Text>
          .
      </Text>
    </View>
    
  );
}

const theme = {
  light: {
    background: '#f2f2f2',
    card: '#f2f2f2',
    text: '#2a2a2a',
    textMuted: '#7d7d7d',
    border: '#2a2a2a',
    primary: '#0040FF', //#00d238
  },
  dark: {
    background: '#2a2a2a', 
    card: '#2a2a2a',   
    text: '#f8fafc', 
    textMuted: '#7d7d7d',
    border: '#f2f2f2',
    primary: '#fdfd2d',
  }
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginBottom: 30, 
  },
  mainPageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  loginPageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  }, 
  recordPageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  historyPageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsPageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },  
  themeToggle: {
    padding: 5,

  },
  balanceCard: {
    width: '90%',
    padding: 25,
    borderRadius: 16,
    borderWidth: 1,
    margin: 10,
  },
  actionsRow: {
    flexDirection: 'row', // Tlačítka vedle sebe!
    justifyContent: 'space-between',
    width: '90%',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 5,
  },
  signOutButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 'auto',
    marginBottom: 30,
    width: '90%',
    // borderColor: '#ef4444',
    backgroundColor: '#ef4444',
  },
  logInButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 10,
    width: '90%',
  },
  signUpButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    width: '90%',
  },
  incomeExpenseButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 15,
    marginHorizontal: 5,
    borderWidth: 1,
  },
  deleteRecordButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 'auto',
    width: '90%',
    borderWidth: 1,
  },
  saveRecordButton: {
    backgroundColor: '#74d836',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    width: '90%',
    borderWidth: 1,
  },
  cancelRecordButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    width: '90%',
    borderWidth: 1,
  },
  historyFilterButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    marginHorizontal: 5,
    borderWidth: 1,
  },

  closeHistoryButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 20,
    width: '90%',
    borderWidth: 1,
  },

    closeSettingsButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 20,
    width: '90%',
    borderWidth: 1,
  },

  logInPageContainer:{
    width: '90%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: '50%',
  },
  rocordPageBottomContainer: {
    marginTop: 'auto',
    width: '100%', 
    alignItems: 'center', 
    marginBottom: 10,
  },
  logInPageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 'auto',
  },
  recordPageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
  },
  incomeExpenseRow: {
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
  },
  historyFilterRow: {
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
  },
  historyRecordRow: {
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
  },
  historyScrollView: {
    flex: 1,
    width: '100%',
  },
  historyScrollContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },

  settingsContent: {
    width: '90%',
  },
  settingsRow: {
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 5,
  },
  settingsActions: {
    width: '90%',
    margin: 5,
    marginTop: 'auto',
  },
  settingsActionButton: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },

  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 90,
    margin: 5,
  },
  
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: '80%',
    borderRadius: 15,
    borderWidth: 1,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
  },
  
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderBottomWidth: 0.5,
  },
  txCurrencyDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginLeft: 10,
    minWidth: 75,
  },
categoriesSectionContainer: {
    flexDirection: 'column',
    width: '90%',
    marginTop: 5,
    marginBottom: 5,
  },
  categoriesScroll: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadgeIcon: {
    marginRight: 4,
    fontSize: 14,
  },
  categoryBadgeText: {
    fontWeight: '600',
    fontSize: 14,
  },
  addCategoryRow: {
    flexDirection: 'row',    
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',             
    marginTop: 5,
  },
  iconInput: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    marginRight: 6,
    fontSize: 16,
  },
  nameInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 6,
    fontSize: 14,
  },
  addCategoryButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCategoryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  summaryContainer: {
  width: '90%',
  alignSelf: 'center',
  marginVertical: 14,
  padding: 16,
  borderRadius: 16,
  borderWidth: 1,
},
monthFilterBadge: {
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 20,
  borderWidth: 1,
  marginRight: 8,
},
summaryRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
},
summaryText: {
  fontSize: 14,
  fontWeight: '700',
},
progressBarTrack: {
  height: 10,
  backgroundColor: '#334155',
  borderRadius: 5,
  overflow: 'hidden',
  marginBottom: 8,
  width: '100%',
},
progressBarFill: {
  height: '100%',
  borderRadius: 5,
},

categoriesSection: {
  marginTop: 10,
},
divider: {
  height: 1,
  marginVertical: 12,
},
categoriesTitle: {
  fontSize: 13,
  fontWeight: '700',
  marginBottom: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
},
catRow: {
  marginBottom: 10,
},
catInfoRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
},
catName: {
  fontSize: 13,
  fontWeight: '600',
},
catAmount: {
  fontSize: 12,
  fontWeight: '600',
},
miniBarTrack: {
  height: 6,
  borderRadius: 3,
  overflow: 'hidden',
  width: '100%',
},
miniBarFill: {
  height: '100%',
  borderRadius: 3,
},
});
